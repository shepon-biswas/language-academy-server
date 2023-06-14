require("dotenv").config();
const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const cors = require("cors");
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);

const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

// Verify JWT
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: "Unathorized Access" });
  }
  // bearer token
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(403).send({ error: true, message: "Forbidden Access" });
    }
    req.decoded = decoded;
    next();
  });
};

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.gexry4e.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const usersCollection = client.db("fluentAcademyDB").collection("users");
    const classesCollection = client
      .db("fluentAcademyDB")
      .collection("classes");
    const cartsCollection = client.db("fluentAcademyDB").collection("carts");
    const paymentsCollection = client.db("fluentAcademyDB").collection("payments");

    // Generate JWT
    app.post("/generate-jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // VerifyAdmin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "Forbidden Access" });
      }
      next();
    };

    // Classes related APIs
    app.post("/classes", async (req, res) => {
      const newClass = req.body;
      console.log(newClass)
      const result = await classesCollection.insertOne(newClass);
      res.send(result);
    });

    // All Classes
    app.get("/classes", async (req, res) => {
      const status = req.query.status;
      let query = {};
      if (status) {
        query = { status: status };
      }
      const result = await classesCollection
        .find(query)
        .sort({ status: 1, enrolled_student:-1 })
        .toArray();
      res.send(result);
    });

    // Class Update
    app.get("/classes/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classesCollection.findOne(query);
      res.send(result);
    });

    // get all users
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    //post users info
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: " User Already Exists" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users/role/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        return res.status(403).send({ error: true, message: "Forbidden" });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { role: user.role };
      res.send(result);
    });

    //get data based on user role (instructor) role
    app.get("/users/instructors", async (req, res) => {
      const result = await usersCollection
        .find({ role: "instructor" })
        .toArray();
      res.send(result);
    });

    // carts data post
    app.post("/carts", async (req, res) => {
      const newCart = req.body;
      const result = await cartsCollection.insertOne(newCart);
      res.send(result);
    });
    // Carts data get
    app.get("/carts", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await cartsCollection.find(query).toArray();
      res.send(result);
    });
    // get cart data by id
    app.get("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartsCollection.findOne(query);
      res.send(result);
    });
    // cart data delete by id
    app.delete("/carts/:id", async(req, res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await cartsCollection.deleteOne(query);
      res.send(result)
    })

    // create payment intended
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      try {
        const { price } = req.body;
        // console.log(price);
        const amount = parseInt(price * 100);
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ["card"],
        });
        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      } catch (error) {
        console.error("Error creating payment intent:", error);
        res.status(500).send({ error: "Failed to create payment intent." });
      }
    });


    app.post('/payments', verifyJWT, async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentsCollection.insertOne(payment);

      // Delete enrolled class from cart
      const cartClassId = payment.cartClassId;
      const deleteQuery = { _id: new ObjectId(cartClassId) }
      const deleteResult = await cartsCollection.deleteOne(deleteQuery);

      // // update enrolled class student number and seats count
      const classId = payment.classId;
      const updateQuery = { _id: new ObjectId(classId) };
      const updateOperation = { $inc: { enrolled_student: 1, seats: -1 } };
      const updateResult = await classesCollection.updateOne(updateQuery, updateOperation);

      res.send({ insertResult, deleteResult, updateResult });
  })
  // get enrolled classes by email
  app.get("/payments", verifyJWT, async (req, res) => {
    const email = req.query.email;
    const query = { email: email };
    const result = await paymentsCollection.find(query).sort({ date:-1 }).toArray();
    res.send(result);
  });

    // Make Admin API
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Make Instructor api
    app.patch("/users/instructors/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "instructor",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Make a Class/Course Approved
    app.patch("/classes/approved/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "approved",
        },
      };
      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    // Make a Class/Course Denied
    app.patch("/classes/denied/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "denied",
        },
      };
      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Give Feedback to instructor
    app.patch("/classes/:id", verifyJWT, verifyAdmin, async(req, res)=>{
      const id = req.params.id;
      const feedback = req.body;
      const updateFeedback = {
        $set: feedback
      }
      const query = {_id: new ObjectId(id)}
      const result = await classesCollection.updateOne(query, updateFeedback)
      res.send(result)
    })


    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is Running...");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
