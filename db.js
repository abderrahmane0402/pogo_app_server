import mongoose from "mongoose"

const connection = {}

async function dbConnect() {
  if (connection.isConnected) {
    return
  }
  const db = await mongoose.connect("mongodb://127.0.0.1:27017", {
    dbName: "pojoPay",
  })

  connection.isConnected = db.connections[0].readyState
}

export { dbConnect }
