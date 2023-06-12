const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express()

require('dotenv').config()
const port = process.env.PORT || 5000






// middleware
app.use(cors());
app.use(express.json())

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' });
    }
    console.log(authorization)
    // bearer token
    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            console.log(err)
            return res.status(401).send({ error: true, message: 'unauthorized access' })

        }

        req.decoded = decoded;
        next();
    })
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2fbz8ar.mongodb.net/?retryWrites=true&w=majority`;

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


        const usersCollection = client.db("graphic_db").collection("users");
        const allClasses = client.db("graphic_db").collection("classes");
        const bookedClasses = client.db("graphic_db").collection("booked");

        // jwt
        app.post('/jwt', (req, res) => {
            const user = req.body;
            console.log(user)
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '24h' });
            res.send({ token })
        })


        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }

        const verifyInstructor = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'instructor') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }


        // user related api

        app.get('/users', async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        })


        app.post('/users', async (req, res) => {
            const user = req.body;
            console.log(user);
            const query = { email: user.email }
            const existingUser = await usersCollection.findOne(query);
            console.log('existing user', existingUser)
            if (existingUser) {
                return res.send({ message: 'user already exists' })
            }


            const result = await usersCollection.insertOne(user);
            res.send(result);

        })


        // admin api

        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'admin'
                },
            };

            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);

        })

        // check admin
        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({ admin: false })
            }

            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { admin: user?.role === 'admin' }
            res.send(result);
        })



        // make instructor api


        app.patch('/users/instructor/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'instructor'
                },
            };

            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);

        })


        // check instructor
        app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({ instructor: false })
            }

            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { instructor: user?.role === 'instructor' }
            res.send(result);
        })





        //  classes related apis
        app.get('/classes', async (req, res) => {
            let query = {};
            if (req.query?.email) {
                query = { email: req.query.email }
            }

            const result = await allClasses.find(query).toArray();
            res.send(result);
        });



        app.post('/classes', verifyJWT, verifyInstructor, async (req, res) => {
            const newItem = req.body;
            const result = await allClasses.insertOne(newItem)
            res.send(result);
        })



        app.patch('/classes/:id', async (req, res) => {
            const status = req.body.status;

            console.log(status)
            const id = req.params.id;
            console.log(id);
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    status: status
                },
            };

            const result = await allClasses.updateOne(filter, updateDoc);
            res.send(result);

        })

        app.put('/classes/:id', async (req, res) => {
            const id = req.params.id;
            const body = req.body;
            console.log(id, body);

            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true }
            const updateDoc = {
                $set: body
            };
            const result = await allClasses.updateOne(filter, updateDoc, options);
            res.send(result);


        })

        app.delete('/classes/:id', verifyJWT, verifyInstructor, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await allClasses.deleteOne(query);
            res.send(result);
        })



        // booked class api 

        app.get('/booked', verifyJWT, async (req, res) => {
            const email = req.query.email;

            if (!email) {
                res.send([]);
            }

            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }
            const query = { user_email: email };
            const result = await bookedClasses.find(query).toArray();
            res.send(result);
        });



        app.post('/booked', async (req, res) => {
            const item = req.body;
            console.log(item);
            const result = await bookedClasses.insertOne(item);
            res.send(result);
        })

        app.delete('/booked/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await bookedClasses.deleteOne(query);
            res.send(result);
        })


        // create payment intent
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseFloat(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret
            })
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




app.get('/', (req, res) => {
    res.send('Graphic School server is running!')
})


app.listen(port, () => {
    console.log(`app listening on port ${port}`)
})












// // popular 6 class sort

// app.get("/musicDataSort", async (req, res) => {

//     const sort = req.query.sort;


//     const options = {

//         sort: { numberOfStudents: sort == "asc" ? 1 : -1 },

//     };

//     console.log(173, options);
//     const result = await musicDataCollection

//         .find()

//         .sort({ numberOfStudents: sort - "asc" ? 1 : -1 })

//     .limit(6)

//         .toArray();

//     console.log(173, result);

//     res.send(result);
// });