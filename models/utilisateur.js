import { model, Schema } from "mongoose"

const cartebancaireSchema = new Schema({
  nomProprietaire: { type: String, required: true },
  numCarte: { type: Number, required: true, unique: true, sparse: true },
  cvv: { type: Number, required: true },
  dateExperation: { type: Date, required: true },
  isdefault: { type: Boolean, default: false },
})

const utilisateurSchema = new Schema({
  nom: { type: String, required: true },
  date_creation: { type: Date, default: Date.now },
  photo: String,
  prenom: { type: String, required: true },
  telephone: { type: Number, required: true, unique: true },
  password: { type: String, required: true },
  carteBancaire: { type: [cartebancaireSchema], default: [] },
})

const Utilisateur = model("Utilisateur", utilisateurSchema)

export default Utilisateur
