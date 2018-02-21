var errors = require('throw.js');
//var AWS = require('aws-sdk');
//AWS.config.update({region:'us-east-1'});
//var sqs = new AWS.SQS();
var Promise = require("bluebird");

//var sns = new AWS.SNS();

function Model(){
};


Model.prototype.ping = function(){
  return Promise.resolve({success:true})
}

module.exports = Model;
