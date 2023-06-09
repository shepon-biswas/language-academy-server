const express = require('express');
const app = express();
require('dotenv').config()
const cors = require('cors');
const port = process.env.PORT || 5000;


// middleware
app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.gexry4e.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const usersCollection = client.db("fluentAcademyDB").collection("users");

    // get all users
    app.get('/users', async(req, res)=>{
        const result = await usersCollection.find().toArray();
        res.send(result);
    })
    //post users info
    app.post('/users', async(req, res)=>{
        const user = req.body;
        const query ={email: user.email}
        const existingUser = await usersCollection.findOne(query)
        if(existingUser){
          return res.send({message : " User Already Exists"})
        }
        const result = await usersCollection.insertOne(user);
        res.send(result);
    })

    // Make Admin API
    app.patch('/users/admin/:id', async(req, res)=>{
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)}
      const updateDoc = {
        $set:{
          role: 'admin'
        }
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get("/", (req, res)=>{
    res.send("Server is Running...")
})

app.listen(port, ()=>{
    console.log(`Server is running on port ${port}`);

})











