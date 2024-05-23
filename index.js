import express, { json } from "express"
import { dbConnect } from "./db.js"
import AuthRouter from "./routes/auth.js"
import UserRouter from "./routes/user.js"

const app = express()
const port = 3000

app.use(json())
app.use("/auth", AuthRouter)
app.use("/user", UserRouter)

dbConnect()
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err))

app.get("/", async (req, res) => {

  // const user = await Utilisateur.findOne({ telephone: "777524479" }).select(
  //   "-telephone"
  // )
  res.send('hi')

})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})


