var moment = require("moment");
var errors = require("throw.js");
var Registros = require("../helpers/sqs");
var Numeral = require("numeral");
var IntegrationProveedor = require("../integration/salesforce/proveedor");
var IntegrationFactura = require("../integration/salesforce/factura");
var Proveedor = require("./proveedor");
var Factura = require("./factura");

function Model(knex, user){
  this.user = user;
  this.knex = knex;
  this.models = {
    Factura: new Factura(knex,user),
    Proveedor: new Proveedor(knex,user)
  }
};

Model.prototype.resetProveedor = function(){
  return new IntegrationProveedor(this.knex,this.user,this.models).resetRds();
}

Model.prototype.resetFactura = function(){
  return new IntegrationFactura(this.knex,this.user, this.models).resetRds();
}


module.exports= Model;
