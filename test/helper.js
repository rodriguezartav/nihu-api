var env = process.env.NODE_ENV || "development";
var knexFile = require("../knexfile");
var Knex = require("knex");
var knex = require('knex')(knexFile[env]);
var User;

var Helper = {
  knex: knex
}


module.exports = Helper;
