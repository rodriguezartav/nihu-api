var moment = require("moment");
var errors = require("throw.js");
var Promise = require("bluebird");

function Model(knex, user){
  this.user = user;
  this.knex = knex;
};

Model.prototype.create = function(){
    return Promise.resolve(true);
}

module.exports= Model;