var Helper = require("./helper");
var chai = require('chai');
var BbPromise = require("bluebird");
var should = chai.should();
var env = process.env.NODE_ENV || "development";
var knexFile = require("../knexfile");
var Knex = require("knex");
var IndexHandler = require("../index");

//Our parent block
describe('Handler', () => {


  it('it should return ok', function(done){

    IndexHandler.handler(
      {
        path: "/",body: JSON.stringify({ok: true}),
        requestContext:
          { authorizer:
            { namespace_id: "unit_test",id: -1 }
          }
      }
      , {}, function(err, result){
      console.log(err);
      result.should.not.equal(null);
      done();
    })
  });

  it('it should return error', function(done){
    IndexHandler.handler({
      path: "/operations/cxp/none",
      requestContext:
        { authorizer:
          { namespace_id: "unit_test",id: -1 }
        }
    },{}, function(err, result){
      result.statusCode.should.equal(500);
      done();
    })
  });

});
