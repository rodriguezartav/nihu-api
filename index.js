'use strict';
var ServiceHelper = require("./proton81/service");

exports.handler = (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;
  ServiceHelper(event, context, callback)
};
