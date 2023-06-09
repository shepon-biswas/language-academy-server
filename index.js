const express = require('express');
const app = express();
require('dotenv').config()
const jwt = require('jsonwebtoken');
const cors = require('cors');
const port = process.env.PORT || 5000;


// middleware
app.use(cors());
app.use(express.json());

// Verify JWT
const verifyJWT = (req, res, next)=>{
  const auhthorization = req.headers.auhthorization;
  console.log(auhthorization);

  if(!auhthorization){
    return res.status(401).send({error:true, message: "Unathorized Access"})
  }
  // bearer token
  const token = auhthorization.split(" ")[1];

  jwt.verify(token, proccess.env.ACCESS_TOKEN, (err, decoded)=>{
    if(err){
      return res.status(403).send({error:true, message: "Forbidden Access"})
    }
    req.decoded = decoded;
    next();
  })
}

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

    // Generate JWT
    app.post("/generate-jwt", (req, res)=>{
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "1h"
      })
      res.send({token})
    })

    // VerifyAdmin
    const verifyAdmin = async(req, res, next)=>{
      const email = req.decoded.email;
      const query = {email: email}
      const user = await usersCollection.findOne(query);
      if(user?.role !== 'admin'){
        return res.status(403).send({error : true, message : 'Forbidden Access'})
      }
      next();
    }

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

    // Make Instructor api
    app.patch('/users/instructors/:id', async(req, res)=>{
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)}
      const updateDoc = {
        $set:{
          role: 'instructor'
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











