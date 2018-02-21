require('dotenv').config()

var Lambda = require("./index");

var cors = require('cors')
process.env.NODE_ENV = "development";
'use strict';

const express = require('express');
var bodyParser = require('body-parser')
var JWT = require("./proton81/jwt");

// Constants
const PORT = 3000;
const HOST = '0.0.0.0';

// App
const app = express();
app.use(cors())
app.use(bodyParser.json({
  limit: '50mb'
}))
app.use(bodyParser.urlencoded({
  limit: '50mb',
  extended: true
}));

app.get('/login/checkstatus', (req, res) => {

  var auth = req.headers.authorization || req.headers.Authorization;

  res.send({
    success: true,
    user: {
      first_name: "local",
      last_name: "dev",
      namespace_id: "development"
    }
  })

})

app.all('/cxp/:model/:operation', (req, res) => {
  req.headers.Host = "localhost:3000";
  Lambda.handler({
    path: req.path,
    requestContext: {
      authorizer: {
        profile: "admin",
        authorization: "abc",
        namespace_id: req.headers["x-namespace_id"] || req.headers["x-namespace"] || process.env.NODE_ENV,
        id: 1
      }
    },
    body: req.body,
    queryStringParameters: req.query,
    headers: req.headers
  }, {}, function(err, result) {
    if (err) {
      var error = err;
      try {
        error = JSON.parse(err);
      } catch (e) {}
      return res.status(error.status || 500).send(err);
    } else {
      console.log(result.headers)
      res.set(result.headers);
      res.status(result.statusCode).send(result.body);
    }
  })
});



app.all('/public/:model/:operation', (req, res) => {

  Lambda.handler({
    path: req.path,
    body: req.body,
    queryStringParameters: req.query,
    headers: req.headers
  }, {}, function(err, result) {
    if (err) {
      var error = err;
      try {
        error = JSON.parse(err);
      } catch (e) {}
      return res.status(error.status || 500).send(err);
    } else {
      console.log(result)
      res.set(result.headers);
      res.status(result.statusCode)
      res.send(result.body);
    }
  })
});

app.listen(PORT, HOST);
console.log(`Running on http://${HOST}:${PORT}`);
