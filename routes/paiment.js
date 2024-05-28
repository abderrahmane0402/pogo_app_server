import { Router } from "express"
import { authenticateToken } from "../middleware.js"
import { body, validationResult } from "express-validator"
import { parseStringPromise } from "xml2js"
import Utilisateur from "../models/utilisateur.js"
import Paiment from "../models/paiment.js"

const router = Router()

// paiment validator
const paimentValidator = [
  body("amount").trim().notEmpty().isNumeric(),
  body("numCarte").trim().notEmpty().isNumeric().isLength(16),
  body("cvv").trim().notEmpty().isNumeric().isLength(3),
  body("dateExperation").trim().notEmpty().isISO8601().toDate(),
  body("user_id").trim().notEmpty(),
  body("carte_id").trim().notEmpty(),
  (req, res, next) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json({ message: "Validation failed", errors: errors.array() })
    }
    next()
  },
]

router.post("/", authenticateToken, paimentValidator, async (req, res) => {
  try {
    const {
      amount,
      numCarte,
      cvv,
      dateExperation,
      user_id: recepteur_id,
      carte_id,
    } = req.body
    const { id: emeteur_id } = req.user

    // recuperatoin des informations nécessaire
    const emeteur = await Utilisateur.findById(emeteur_id).select(
      "carteBancaire"
    )

    const recepteur = await Utilisateur.findById(recepteur_id).select(
      "carteBancaire"
    )

    if (!emeteur || !recepteur) {
      return res
        .status(404)
        .json({ message: "Utilisateur introuvable", status: "error" })
    }

    if (emeteur_id == recepteur_id) {
      return res
        .status(400)
        .json({ message: "Paiment impossible", status: "error" })
    }

    // recuperation de la carte
    if (
      emeteur.carteBancaire.length == 0 ||
      recepteur.carteBancaire.length == 0
    ) {
      return res
        .status(404)
        .json({ message: "aucun carte bancaire trouvé", status: "error" })
    }

    const emeteurCarte = emeteur.carteBancaire.find((carte) => carte.isdefault)
    const recepteurCarte = recepteur.carteBancaire.find(
      (carte) => carte.isdefault
    )
    if (!emeteurCarte || !recepteurCarte) {
      return res.status(404).json({ message: "Carte bancaire non trouvée" })
    }

    // formatage de la date d'expiration
    const expirationDate = new Date(dateExperation)
    const month = String(expirationDate.getMonth() + 1).padStart(2, "0") // Adding 1 as getMonth() returns 0-indexed month
    const year = expirationDate.getFullYear()

    const formattedExpirationDate = `${month}/${year}`

    const cmi_api = "https://testpayment.cmi.co.ma/fim/api"

    // Preauthorization
    const preRequestPayload = `
      <CC5Request>
        <Name>pogo_api</Name>
        <Password>Pogo_api2022</Password>
        <ClientId>600003404</ClientId>
        <Type>PreAuth</Type>
        <Total>${amount}</Total>
        <Currency>504</Currency>
        <Number>${numCarte}</Number>
        <Expires>${formattedExpirationDate}</Expires>
        <Cvv2Val>${cvv}</Cvv2Val>
      </CC5Request>
    `
    const preRequestResponse = await fetch(cmi_api, {
      method: "POST",
      headers: {
        "Content-Type": "application/xml",
      },
      body: preRequestPayload,
    })

    const preRequestResponseText = await preRequestResponse.text()

    const { CC5Response: preResponse } = await parseStringPromise(
      preRequestResponseText,
      {
        explicitArray: false,
      }
    )

    if (preResponse.Response == "Declined" || preResponse.Response == "Error") {
      await new Paiment({
        emeteur: emeteur_id,
        destinataire: recepteur_id,
        cartebancaireEmeteur: emeteurCarte.id,
        cartebancaireDestinataire: recepteurCarte.id,
        montant: amount,
        dateOperation: new Date(),
        Etat_de_la_transaction: "échouer",
        remarque: preResponse.ErrMsg,
      }).save()

      return res
        .status(400)
        .json({ message: preResponse.ErrMsg, status: preResponse.Response })
    }

    // Postauthorization
    const postRequestPayload = `
      <CC5Request>
        <Name>pogo_api</Name>
        <Password>Pogo_api2022</Password>
        <ClientId>600003404</ClientId>
        <Type>PostAuth</Type>
        <OrderId>${preResponse.OrderId}</OrderId>
      </CC5Request>
    `
    const postRequestResponse = await fetch(cmi_api, {
      method: "POST",
      headers: {
        "Content-Type": "application/xml",
      },
      body: preRequestPayload,
    })
    const postRequestResponseText = await postRequestResponse.text()

    const { CC5Response: postResponse } = await parseStringPromise(
      postRequestResponseText,
      {
        explicitArray: false,
      }
    )

    if (
      postResponse.Response == "Declined" ||
      postResponse.Response == "Error"
    ) {
      await new Paiment({
        emeteur: emeteur_id,
        destinataire: recepteur_id,
        cartebancaireEmeteur: emeteurCarte.id,
        cartebancaireDestinataire: recepteurCarte.id,
        montant: amount,
        dateOperation: new Date(),
        Etat_de_la_transaction: "échouer",
        remarque: postResponse.ErrMsg,
      }).save()
      return res
        .status(400)
        .json({ message: postResponse.ErrMsg, status: postResponse.Response })
    }

    // transaction reussite
    await new Paiment({
      emeteur: emeteur_id,
      destinataire: recepteur_id,
      cartebancaireEmeteur: emeteurCarte.id,
      cartebancaireDestinataire: recepteurCarte.id,
      montant: amount,
      dateOperation: new Date(),
      Etat_de_la_transaction: "réussie",
      remarque: "Paiment effectuer avec succès",
    }).save()
    return res
      .status(200)
      .json({ message: "Paiment success", status: postResponse.Response })
  } catch (error) {
    console.error(error.message)
    res.status(500).json({ message: error.message, status: "error" })
  }
})

export default router
