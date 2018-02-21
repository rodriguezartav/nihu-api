var Helper = require("./helper");
var chai = require('chai');
var BbPromise = require("bluebird");
var should = chai.should();
var env = process.env.NODE_ENV || "development";
var knexFile = require("../knexfile");
var Knex = require("knex");
var Cxp = require("../operations/facturas");
var cxp = new Cxp(Helper.knex, {id: 1, namespace_id: "unit_test" + parseInt( Math.random() * 10000 ) });



//Our parent block
describe('Cxp', () => {


  it('it should create a cxp', function(done){

    cxp.all({
      first_name: "test",
      last_name:"test",
      "email":"thistest@test.com",
      "mobile_phone":"123"
    })
    .then( function(result){
      result.length.should.equal(0);
      done();
    })
  });

});


