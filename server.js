require('dotenv').config()
const yargs = require('yargs')(process.argv.slice(2))
const express = require('express')
const session = require('express-session')
const passport = require('passport')
const LocalStrategy = require('passport-local').Strategy
const mongoose = require('mongoose')
const { urlencoded } = require('express')
const Users = require('./model')
const routes = require('./routes')
const { fork } = require('child_process')

const app = express()
app.use(express.urlencoded({ extended:true }))

const argv = yargs
    .default({
        port:3000
    })
    .alias({
        p:'port'
    })
    .argv

const port = argv.port



passport.use('login',new LocalStrategy(
    (username,password,done) => {
        Users.findOne({username}, (err,user) =>{
            if(err) return done(err)
            if(!user) console.log('User not found')

            return done(null,user)
        })
    }
))

passport.use('signup', new LocalStrategy(
    { passReqToCallback:true },
    (req,username,password,done) => {
        console.log('SignUp...')
        Users.findOne({username},(err,user) => {
            if(err) return done(err)
            if(user) {
                console.log('User already exists')
                return done(null,false)
            }
            
            const newUser = {
                username,
                password,
                name:req.body.name
            }
            Users.create(newUser,(err, userWithID) => {
                if(err) return done(err)

                console.log(userWithID)
                return done(null,userWithID)
            })
        })
    }
))

passport.serializeUser((user,done) => {
    done(null,user._id)
})

passport.deserializeUser((id,done) => {
    Users.findById(id,done)
})

app.use(session({
    secret:'secret',
    resave:false,
    saveUninitialized:false,
    rolling:true,
    cookie:{
        maxAge:30000,
        secure:false,
        httpOnly:true
    }
}))

app.use(passport.initialize())
app.use(passport.session())

//define routes
app.get('/',routes.getRoot)
app.get('/login',routes.getLogin)
app.post('/login',
        passport.authenticate('login'),
        routes.postLogin
)
app.get('/signup',routes.getSignup)
app.post(
    '/signup',
    passport.authenticate('signup', {failureRedirect: 'getFailSignup'}),
    routes.postSignup
)
app.get('/failsignup',routes.getFailSignup)

function checkAuthentication(req,res,next){
    if(req.isAuthenticated()) next()
    else res.redirect('/login')
}

app.get('/private',checkAuthentication, (req,res) => {
    const {user} = req
    res.send('<h1>Solo pudiste entrar porque estas logueado 🚀 </h1>')
})

app.get('/info', (req, res) => {
    const processDetails = {
        'Argumento de entrada': process.argv,
        'Nombre de la plataforma': process.platform,
        'Version de node.js':process.version,
        'Memoria total reservada (rss)':process.memoryUsage.rss(),
        'Path de ejecución':process.execPath,
        'Process id':process.pid,
        'Carpeta del proyecto':process.cwd()
        
    }
  res.json(processDetails)
})

app.get('/api/random',(req,res) => {
    const cant  = req.query.cant || 500000000

    const computo = fork('./random.js')
    computo.send({cant})
    computo.on('message', result => {
        return res.json(result)
    })

    
})

function connectDB(url,cb){
    mongoose.connect(
        url,
        {
            useNewUrlParser: true,
            useUnifiedTopology: true
        },
        err => {
            if(!err) console.log('Connected')
            if(cb != null) cb(err)
        }
    )
}

connectDB(`mongodb://${process.env.HOST_DB}:${process.env.PORT_DB}/coderhouse`, err => {
  if(err) return console.log('Error connecting DB',err)  

  app.listen(port, () => console.log(`Example app listening on port ${port}!`))
})