var moment = require("moment");
var errors = require("throw.js");
var Factura = require("./factura");
var IntegrationProveedor = require("../integration/salesforce/proveedor");
var ErrorHelper = require("../proton81/error");
var Ajv = require('ajv');

function Model(knex, user){
  this.user = user;
  this.knex = knex;
  this.models = {
     Factura: Factura,
     Proveedor: Model
   }
};

Model.table_name = "proveedor";
Model.prototype.table_name = "proveedor";

Model.createSchema = require("../validations/proveedor_create.json");
Model.updateSchema = require("../validations/proveedor_update.json");

Model.prototype.getColumnsForCreate = function(body){
  console.log(body);

  return Promise.resolve(
    {
      saveRoute: "cxp/proveedor/save",
      title: "Crear Documento por Pagar",
      columns: [
        {name: "id", type: "hidden", value: body.id},
        {name: "activo", value: true ,type: "hidden"},
        {name: "label1", type: "label", title: "Detalles del Proveedor"},
        {name: "nombre", type: "text", title: "Nombre", size: "third"},
        {name: "descripcion", type: "text", title: "Descripcion", size: "third"},
        {name: "forma_de_pago", type: "text", title: "Forma de Pago", size: "third"},
        {name: "plazo", value:0 , type: "number", title: "Plazo", size: "third"},
        {name: "tipo_de_cedula", value:"Persona Juridica" ,type: "radio",options: ["Persona Juridica","Persona Fisica"],title: "Tipo de Cedula", size: "third"},
        {name: "cedula", type: "text", title: "Cedula", size: "third"},
        {name: "email_notificacion", type: "text", title: "Email de notificacion", size: "third"},
        {name: "tipo", value:"Local" ,type: "radio",options: ["Local","Internacional"],title: "Tipo", size: "third"},
        {name: "moneda", value:"Colones" ,type: "radio",options: ["Colones","Dolares","Euros"],title: "Moneda", size: "third"}
      ]
  })
}

Model.prototype.getColumnsForEdit = function(body){
  console.log(body);

  return Promise.resolve(
    {
      saveRoute: "cxp/proveedor/save",
      title: "Crear Documento por Pagar",
      columns: [
        {name: "id", type: "hidden", value: body.id},
        {name: "label1", type: "label", title: "Detalles del Proveedor"},
        {name: "nombre", value:body.nombre || "",type: "text", title: "Nombre", size: "third"},
        {name: "descripcion", value:body.descripcion || "", type: "text", title: "Descripcion", size: "third"},
        {name: "observaciones", value:body.observaciones || "", type: "text", title: "Observaciones", size: "third"},
        {name: "forma_de_pago", value:body.forma_de_pago || "", type: "text", title: "Forma de Pago", size: "third"},
        {name: "tipo_de_cedula", value:body.tipo_de_cedula || "",type: "radio",options: ["Persona Juridica","Persona Fisica"],title: "Tipo de Cedula", size: "half"},
        {name: "cedula", value:body.cedula || "", type: "text", title: "Cedula", size: "third"},
        {name: "email_notificacion", value:body.email_notificacion || "", type: "text", title: "Email de notificacion", size: "third"},
        {name: "tipo", value:body.tipo || "",type: "radio",options: ["Local","Internacional"],title: "Tipo", size: "third"},
        {name: "plazo", value:body.plazo || 0, type: "number", title: "Plazo", size: "third"},
        {name: "moneda", value:body.moneda || "",type: "radio",options: ["Colones","Dolares","Euros"],title: "Moneda", size: "third"},
        {name: "activo", value:body.activo || false, type: "boolean", title: "Activo", size: "third"}
      ]
  })
}

Model.prototype.save = function(proveedor){
  if(proveedor.id) return this.update(proveedor);
  else return this.create(proveedor);
}

Model.prototype.create = function(proveedor){
  var _this = this;
  proveedor.namespace_id = this.user.namespace_id;
  proveedor.activo = true;

  var ajv = new Ajv({ allErrors: true }); // options can be passed, e.g. {allErrors: true}
  var validate = ajv.compile(Model.createSchema);
  var valid = validate(proveedor);
  if( !valid ) return ErrorHelper.reject(validate.errors, ajv);

  var Integration = new IntegrationProveedor(_this.knex, _this.user, _this.models);
  return this.knex.transaction(function(trx){
    return _this.knex.table(Model.table_name)
    .transacting(trx)
    .insert(proveedor)
    .returning("*")
    .then(function(results){
      return Integration.onNew(results[0],trx)
    })
    .then(trx.commit)
    .catch(trx.rollback)
  })
  .then(function(data){
    return data;
  })
  .catch(function(err){
    throw ErrorHelper.parse(err);
  })
}


Model.prototype.update = function(proveedor){
  var _this = this;
  proveedor.namespace_id = this.user.namespace_id;

  
  var ajv = new Ajv({ allErrors: true }); // options can be passed, e.g. {allErrors: true}
  var validate = ajv.compile(Model.updateSchema);
  var valid = validate(proveedor);
  if( !valid ) return ErrorHelper.reject(validate.errors, ajv);
  
  var Integration = new IntegrationProveedor(_this.knex, _this.user, _this.models);
  return this.knex.transaction(function(trx){
    return _this.knex.table(Model.table_name)
    .transacting(trx)
    .update(proveedor)
    .where({id: proveedor.id})
    .returning("*")
    .then(function(res){
      return Integration.onEdit(proveedor,trx)
    })
    .then(trx.commit)
    .catch(trx.rollback)
  })
  .then(function(data){
    return data;
  })
  .catch(function(err){
    throw ErrorHelper.parse(err);
  })
}

Model.prototype.delete = function(data){
  var _this = this;
  data.namespace_id = this.user.namespace_id;
  data.activo = false;
  data.descripcion = "";
  data.observaciones = "";
  data.forma_de_pago = "";
  data.tipo = "";
  data.cedula = "";
  data.moneda = "";
  data.tipo_de_gasto = "";
  data.tipo_de_cedula = "";
  data.email_notificacion = "";
  data.categoria_de_gasto = "";
  data.plazo = 0;

  var Integration = new IntegrationProveedor(_this.knex, _this.user, _this.models);

  return this.knex.transaction(function(trx){
    return _this.knex.table(Model.table_name)
    .transacting(trx)
    .update(data)
    .where({id: data.id})
    .then(function(res){
        return Integration.onEdit(data,trx)
    })
    .then(trx.commit)
    .catch(trx.rollback)
  })
  .then(function(data){
    return data;
  })
  .catch(function(err){
    throw ErrorHelper.parse(err);
  })
}

Model.prototype.all = function(){
  console.register(["APP","MARK"],"DB OP START");
  return this.knex.table(Model.table_name)
  .select("*")
  .where({namespace_id: this.user.namespace_id })
  .then(function(results){
    console.register(["APP","MARK"],"DB OP END");
    return results;
  })
}

Model.prototype.one = function(id){
  return this.knex.table(Model.table_name)
  .select("*")
  .where({id: id })
  .then(function(results){
    if(!results || results.length == 0) throw new errors.NotFound();
    return results[0];
  })
}

Model.prototype.batchInsert = function(rows){
  var chunkSize = 30;
  return this. knex.batchInsert(Model.table_name, rows, chunkSize)
  .returning('*')
}

Model.prototype.deleteAll = function(id){
  var _this = this;
  return this.knex.table(Model.table_name)
  .delete("*")
  .where({namespace_id: this.user.namespace_id})
}

Model.prototype.batchUpdate = function(records,updateFields){
  var _this = this;
  var sqls = [];
  records.forEach( function(record){
    var sql = _this.knex.table(Model.table_name).insert(record).toString();
    var addOn = [ ' ON CONFLICT (id) DO UPDATE SET'];
    updateFields.forEach( function(fieldName){
      var parts = [fieldName, "=", "EXCLUDED", ".", fieldName];
      if( addOn.length != 1 ) addOn.push(",");
      addOn.push( parts.join("") );
    })
    addOn.push('returning *;');
    sqls.push( sql + addOn.join(" ") );
  });
  return this.knex.raw( sqls.join(" ") )
}

module.exports= Model;
