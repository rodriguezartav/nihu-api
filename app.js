var ResponseHelper = require("./helpers/responseHelper");
var Merge = require('merge');
var test;

module.exports = function(event, context, callback) {

  if (event.path == "/" || event.path == "/cxp") event.path = "/public/root/ping";
  var user = event.requestContext.authorizer;
  var payload = event.body;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {}
  payload = Merge(payload, event.queryStringParameters || {});
  console.register(["APP", "PAYLOAD"], JSON.stringify(payload));

  var operationFunction;
  var parts = event.path.split("/");
  if (parts.length < 3) return callback("Only accepted path is /Qualifier/Operation/Function. Current path is " + event.path);

  var Operation;
  try {
    Operation = require("./operations/" + parts[2]);
  } catch (e) {
    throw e;
  }

  if (!Operation) return callback(new Error("Operation not found: " + parts[2]));
  var operation = new Operation(context.knex, user);
  operationFunction = operation[parts[3]];
  if (user.id == -1 && operationFunction.allowPublic == false) return callback("Resource is not public " + parts[3]);
  if (!operationFunction) return callback("Operations Function not found " + parts[3]);

  ResponseHelper(operationFunction.bind(operation)(payload), callback);
}
