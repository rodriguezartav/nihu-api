var moment = require("moment");
var errors = require("throw.js");
var Registros = require("../helpers/sqs");
var Numeral = require("numeral");
var Proveedor = require("./proveedor");
var IntegrationFactura = require("../integration/salesforce/factura");
var Promise = require("bluebird");
var ErrorHelper = require("../proton81/error");
var Ajv = require('ajv');


function Model(knex, user){
  this.user = user;
  this.knex = knex;
  this.models = {
     Factura: Model,
     Proveedor: Proveedor
   }
};

Model.table_name = "factura";
Model.prototype.table_name = "factura";

Model.createSchema = require("../validations/factura_create.json");
Model.updateSchema = require("../validations/factura_update.json");
Model.aplicarSchema = require("../validations/factura_aplicar.json");
Model.anularSchema = require("../validations/factura_anular.json");


Model.prototype.getColumnsForCreate = function(body){
  console.log(body);

  return Promise.resolve(
    {
      saveRoute: "cxp/factura/save",
      title: "Crear Documento por Pagar",
      columns: [
        {name: "id", type: "hidden", value: body.id},
        {name: "label1", type: "label", title: "Detalles del Pago"},
        { "name": "proveedor_id",
          "title":"Proveedor",
          "type":"datalookup",
          "itemKey": "id",
          "principalColumn":"nombre",
          "route": "cxp/proveedor/all",
          "view":"all",
          "size":"half",
          "pingOnChange": "cxp/factura/field_onChange"
        },
        {name: "tipo_de_documento", value:"FA" ,type: "radio",options: ["FA","NC"],title: "Tipo", size: "third"},
        {name: "referencia", type: "text", title: "Referencia", size: "third"},
        {name: "fecha_facturacion", value: moment(new Date()).format("YYYY-MM-DD"), type: "date", title: "Fecha de Facturacion", size: "third"},
        {name: "plazo", value:0 , type: "number", title: "Plazo", size: "third"},
        {name: "observacion", type: "textarea", title: "Observacion", size: "full"},
        {name: "label2", type: "label", title: "Montos y Relacionados"},
        {name: "tipo_cambio",value:1, type: "number", title: "Tipo de Cambio", size: "third"},
        {name: "subtotal",value:0, type: "number", title: "Subtotal", size: "third", "pingOnChange": "cxp/factura/calculate_total"},
        {name: "descuento",value:0, type: "number", title: "Descuento", size: "third", "pingOnChange": "cxp/factura/calculate_total"},
        {name: "impuesto",value:0, type: "number", title: "Impuesto", size: "third", "pingOnChange": "cxp/factura/calculate_total"},
        {name: "total",value:0, type: "number", title: "Total", size: "third",  "pingOnChange": "cxp/factura/calculate_total"}
      ]
  })
}

Model.prototype.field_onChange = function(body){
  var _this = this;

  var promise = function(resolve,reject){
     return _this.knex.table(Proveedor.table_name)
      .select("*")
      .where({id: body.proveedor_id })
      .then(function(response){
        return resolve({
          plazo: parseInt(response[0].plazo) || 0
        })
      })
  }

  return new Promise(promise);
}

Model.prototype.calculate_total = function(body){
  var subtotal = parseFloat(body.subtotal).toFixed(2) || 0;
  var descuento = parseFloat(body.descuento).toFixed(2) || 1;
  var impuesto  = parseFloat(body.impuesto).toFixed(2) || 1;
  return Promise.resolve({
    total: (subtotal - (subtotal*(descuento/100)) + (subtotal*(impuesto/100)))
  })
}


Model.prototype.getColumnsForEdit = function(body){
  console.log(body);

  var map ={
    Pendiente: { saveRoute: "cxp/factura/save", title:"Editando Documento por Pagar", columns: [
      {name: "id", type: "hidden", value: body.id},
      {name: "label1", type: "label", title: "Programacion del Pago"},
      {name: "fecha_pago_programado", value: moment().toDate(), type: "date", title: "Fecha", size: "half"}
    ]},
    Calendarizado: {saveRoute: "cxp/factura/save",title:"Reprogramar Documento Calendarizado", columns: [
      {name: "id", type: "hidden", value: body.id},
      {name: "label1", type: "label", title: "Detalles del Pago"},
      {name: "fecha_pago_programado", value: moment().toDate(), type: "date", title: "Fecha", size: "half"}
    ]},
    "Para Pagar": {saveRoute: "cxp/factura/aplicar",
      columns: [
        {name: "id", type: "hidden", value: body.id},
        {name: "label1", type: "label", title: "Detalles del Pago"},
        {name: "forma_de_pago", type: "radio",options: ["Cheque","Deposito"], title: "Forma de Pago", size: "half"},
        {name: "referencia_forma_pago", type: "textarea", title: "Referencia del Pago", size: "half"},
        {name: "label2", type: "label", title: "Montos y Relacionados"},
        {name: "pago", value: body.saldo||0, type: "number", title: "Monto", size: "half"},
        {name: "tipo_cambio_pago", value: 1, type: "number", title: "Tipo de Cambio", size: "half"},
      ]}
  }
  if(!map[body.estado]) Promise.resolve({});
  return Promise.resolve(map[body.estado]);
}

Model.prototype.save = function(cuenta){
  if(cuenta.id) return this.update(cuenta);
  else return this.create(cuenta);
}

Model.prototype.create = function(cuenta){
  var _this = this;
  cuenta.namespace_id = this.user.namespace_id;
  cuenta.estado = "Pendiente";

  var ajv = new Ajv({ allErrors: true }); // options can be passed, e.g. {allErrors: true}
  var validate = ajv.compile(Model.createSchema);
  var valid = validate(cuenta);
  if( !valid ) return ErrorHelper.reject(validate.errors, ajv);

  return this.knex.table("proveedor")
  .select("plazo","sfid")
  .where("id",cuenta.proveedor_id)
  .then(function(result){
    var cuentaSF = cuenta;
    var Integration = new IntegrationFactura(_this.knex, _this.user, _this.models);
    var Registro = new Registros(_this.knex,_this.user);
    cuenta.proveedor_sfid = result[0].sfid;
    if (cuenta.plazo > 0) cuenta.plazo = result[0].plazo;
    if(cuenta.tipo_de_documento == 'FA'){
      cuenta.estado = cuenta.total > 150000 ? "Pendiente" : "Para Pagar";
      cuenta.fecha_pago_programado = moment(cuenta.fecha_facturacion).startOf('day').utc(6).add(cuenta.plazo, 'days');
      cuenta.fecha_vencimiento = moment(cuenta.fecha_facturacion).startOf('day').utc(6).add(cuenta.plazo, 'days');
    }else if(cuenta.tipo_de_documento == 'NC'){
      cuenta.estado = 'Para Pagar';
      cuenta.subtotal = cuenta.subtotal * -1;
      cuenta.total = cuenta.total * -1;
      cuenta.impuesto = cuenta.impuesto * -1;
      cuenta.descuento = cuenta.descuento * -1;
    }
    cuenta.saldo = cuenta.total;
    cuenta.fecha_ingreso = moment(Date.now()).startOf('day').utc(6);
    var resultsInsert = [];
    return _this.knex.transaction(function(trx){
      return _this.knex.table(Model.table_name)
      .transacting(trx)
      .insert(cuenta)
      .returning("*")
      .then(function(results){
        resultsInsert = results;
        cuentaSF.id = results[0].id;
        var tipo = (cuenta.tipo_de_documento == 'NC') ? 'nota credito de proveedor  ' : 'factura de proveedor  ';
        return Registro.create( cuenta.proveedor_id  , 'saldos por pagar'   , cuenta.tipo_de_documento   ,  tipo + cuenta.referencia ,cuenta.total , trx);
      })
      .then(function(){
        return Integration.onNew(cuentaSF, trx)
      })
    })
    .then(function(response){
      return new Model(_this.knex, _this.user).one(response[0].id);
    })
    .catch(function(err){
      throw new errors.NotFound("Error en el ingreso de cuentas por pagar " + err);
    })
  })
}

Model.prototype.anular = function(row){
  var _this = this;
  row.namespace_id = this.user.namespace_id;
  var id = '';
  var Registro = new Registros(_this.knex,_this.user);
  return this.knex.table(Model.table_name)
  .select("*")
  .where({ id: row.id})
  .then( function(result){
    var Integration = new IntegrationFactura(_this.knex, _this.user, _this.models);
    if(result.length == 0 ) throw new errors.NotFound("The factura does not exists or is not active.")
    else if ( moment(result[0].fecha_ingreso).format("DD/MM/YYYY") != moment(Date.now()).format("DD/MM/YYYY")) throw new errors.NotFound("The factura was not enter today.")
    cuenta = result[0];
    row.sfid = cuenta.sfid;
    row.total = cuenta.total;
    var total = cuenta.total;
    cuenta.total = 0;
    cuenta.saldo = 0;
    cuenta.descuento = 0;
    cuenta.estado = 'Anulado';
    cuenta.impuesto = 0;
    cuenta.plazo = 0;
    cuenta.subtotal = 0;
    cuenta.observacion = null;
    cuenta.pago = 0;
    cuenta.tipo_cambio = null;
    cuenta.tipo_cambio_pago = null;
    return _this.knex.transaction(function(trx){
      return _this.knex.table(Model.table_name)
      .transacting(trx)
      .update(cuenta)
      .where({id:cuenta.id})
      .returning("id")
      .then(function(ids){
        id = ids[0];
        return Registro.create( cuenta.proveedor , 'saldos por pagar'   , 'NULO-' + cuenta.tipo_de_documento   , 'Anular factura de proveedor  ' + cuenta.referencia,total  * -1 , trx)
      })
      .then(function(){
        row.fecha_ingreso = moment(row.fecha_ingreso).startOf('day').utc(6).format("YYYY-MM-DDT00:00:00.000Z");
        return Integration.onAnular(row)
      })
    })
    .then(function(){
        return id
    })
    .catch(function(err){
      throw new errors.NotFound("Error al anular la cuentas por pagar " + err);
    })
  })
  .then(function(id){
    return _this.one(id)
  })
}

Model.prototype.aplicar = function(row){
  var _this = this;
  var id = '';
  row.namespace_id = this.user.namespace_id;
  return this.knex.table(Model.table_name)
  .select("*")
  .where({ id: row.id})
  .then( function(result){
    var Integration = new IntegrationFactura(_this.knex, _this.user, _this.models);
    var Registro = new Registros(_this.knex,_this.user);
    if(result.length == 0 ) throw new errors.NotFound("The factura does not exists or is not active.")
    cuenta = result[0];
    var cuentaSF = cuenta;
    monto = row.pago * -1;
    cuenta.pago= monto;
    diferencialCambiario = 0;
    cuenta.estado = 'Entregado';
    cuenta.forma_pago = row.forma_pago;
    cuenta.tipo_cambio_pago = row.tipo_cambio_pago;
    cuenta.referencia_forma_pago = row.referencia_forma_pago;
    if(cuenta.tipo_cambio > 1 & cuenta.tipo_cambio_pago != cuenta.tipo_cambio){
      var diferencial = cuenta.saldo  + cuenta.pago;
      var difMax = (cuenta.total / cuenta.tipo_cambio)  *  Math.abs(cuenta.tipo_cambio - cuenta.tipo_cambio_pago) ;
      if(Math.abs(diferencial) > ( difMax * 1.01 ) ){
        throw new errors.NotFound('La diferencia ' + difMax + ' es mayor a la differencia por tipo de cambio ' + diferencial);
      }
      cuenta.diferencial_cambiario = diferencial;
      cuenta.saldo += cuenta.pago - diferencial;
      diferencialCambiario = cuenta.diferencial_cambiario;
    }else{
      cuenta.saldo = Numeral(cuenta.saldo).value() + monto ;
    }
    cuenta.fecha_de_pago = moment(Date.now());
    return _this.knex.transaction(function(trx){
      return trx
      .where('id',row.id)
      .update(cuenta)
      .into(Model.table_name)
      .returning("id")
      .then(function(ids){
        id = ids[0];
        return Registro.create( cuenta.id  , 'saldos por pagar'   , 'pa-' + cuenta.tipo_de_documento   , 'pago factura de proveedor  ' + cuenta.referencia , monto - diferencialCambiario, trx  )
      })
      .then(function(){
        if(diferencialCambiario != 0 && diferencialCambiario != null) return Registro.create( cuenta.id  , 'diferencial cambiario'   , 'diferencial cambiario ' + cuenta.tipo_de_documento   , 'pago factura de proveedor  ' + cuenta.referencia , diferencialCambiario, trx )
      })
      .then(function(){
        return Integration.onAplicar(cuentaSF)
      })
    })
    .then(function(){
      return _this.one(id);
    })
  })
}

Model.prototype.update = function(deltaContact){
  var _this = this;
  deltaContact.namespace_id = this.user.namespace_id;
  var id = '';
  if(deltaContact.estado = 'Calendarizado' && moment(deltaContact.fecha_pago_programado).format("MM/DD/YYYY") <= moment(Date.now()).format("MM/DD/YYYY")){
    deltaContact.estado = 'Para Pagar';
  }else{
    deltaContact.estado = 'Calendarizado';
  }
  delete deltaContact.namespace_id;
  return this.knex.table(Model.table_name)
  .select("*")
  .where({ id: deltaContact.id})
  .then( function(results){
    deltaContact.sfid = results[0].sfid;
    var Integration = new IntegrationFactura(_this.knex, _this.user, _this.models);
    if(results.length == 0 ) throw new errors.NotFound("Factura can't be found exist. Code 1")
    return _this.knex.transaction(function(trx){
      return trx
      .where({id: deltaContact.id })
      .update(deltaContact)
      .into(Model.table_name)
      .returning("id")
      .then(function(res){
        id = res;
        return Integration.onUpdate(deltaContact)
      })
    })
    .then(function(){
      return id[0];
    })
    .catch(function(err){
      throw new errors.NotFound("Error al actualizar la cuenta por pagar " + err);
    })
  })
  .then( function(res){
    return _this.one(res)
  })
}

Model.prototype.calendarizar = function(deltaContact){
  return this.update(deltaContact);
}

Model.prototype.delete = function(id){
  var _this = this;
  var updateValues = {
    updated_at: moment(),
    //updated_by: this.user.id,
    active: false
  }
  return this.knex.table(Model.table_name)
  .select("*")
  .where({namespace_id: this.user.namespace_id, id: id})
  .then( function(results){
    if(results.length == 0 ) throw new errors.NotFound("Product does not exists or is not active.")
    updateValues.updates = results[0].updates;
    updateValues.updates.list.push({user: _this.user.name, key: "active", old: "true", current: "false"})
    return _this.knex.table(Model.table_name)
    .update(updateValues)
    .where({id: id, namespace_id: _this.user.namespace_id})
  })
  .then( function(){
    return {};
  })
}

Model.prototype.deleteAll = function(id){
  var _this = this;
  return this.knex.table(Model.table_name)
  .delete("*")
  .where({namespace_id: this.user.namespace_id})
}

Model.prototype.all = function(){
  return this.knex.table(Model.table_name)
  .select(["factura.*","proveedor.nombre as __proveedor__name"])
  .innerJoin("proveedor","factura.proveedor_id","proveedor.id")
  .where("factura.fecha_ingreso",">","2017-10-22")
}

Model.prototype.allForSF = function(){
  return this.knex.table(Model.table_name)
  .select("*")
  .where({namespace_id: this.user.namespace_id})
}

Model.prototype.todo = function(){
  var cuentas = this.knex.table(Model.table_name)
  .select(["factura.*","proveedor.nombre as __proveedor__name","proveedor.plazo as __proveedor__plazo"])
  .innerJoin("proveedor","factura.proveedor_id","proveedor.id")
  .where("factura.fecha_ingreso",">","2017-10-22")
  cuentas = cuentas.map((cuenta)=> {
    if(cuenta.fecha_pago_programado <= moment(Date.now()) && cuenta.estado == "Calendarizado"){
      cuenta.estado = "Para Pagar";
    }
    return cuenta;
  })
  return cuentas;
}

Model.prototype.locales = function(){
  var cuentas = this.knex.table(Model.table_name)
  .select(["factura.*","proveedor.nombre as __proveedor__name","proveedor.plazo as __proveedor__plazo"])
  .innerJoin("proveedor","factura.proveedor_id","proveedor.id")
  .where("factura.fecha_ingreso",">","2017-10-22")
  .andWhere("proveedor.tipo","Local")
  cuentas = cuentas.map((cuenta)=> {
    if(cuenta.fecha_pago_programado <= moment(Date.now()) && cuenta.estado == "Calendarizado"){
      cuenta.estado = "Para Pagar";
    }
    return cuenta;
  })
  return cuentas;
}

Model.prototype.internacionales = function(){
  var cuentas = this.knex.table(Model.table_name)
  .select(["factura.*","proveedor.nombre as __proveedor__name","proveedor.plazo as __proveedor__plazo"])
  .innerJoin("proveedor","factura.proveedor_id","proveedor.id")
  .where("factura.fecha_ingreso",">","2017-10-22")
  .andWhere("proveedor.tipo","Internacional")
  cuentas = cuentas.map((cuenta)=> {
    if(cuenta.fecha_pago_programado <= moment(Date.now()) && cuenta.estado == "Calendarizado"){
      cuenta.estado = "Para Pagar";
    }
    return cuenta;
  })
  return cuentas;
}

Model.prototype.one = function(id){
  return this.knex.table(Model.table_name)
  .select(["factura.*","proveedor.nombre as __proveedor__name"])
  .innerJoin("proveedor","factura.proveedor_id","proveedor.id")
  .where("factura.id",id)
  .then(function(results){
    if(!results || results.length == 0) throw new errors.NotFound();
    return results[0];
  })
}

Model.prototype.byIds = function(ids){
  return this.knex.table(Model.table_name)
  .select(["factura.*","proveedor.nombre as __proveedor__name"])
  .innerJoin("proveedor","factura.proveedor","proveedor.id")
  .whereIn("factura.id",ids)
}

Model.prototype.batchInsert = function(rows){
  var chunkSize = 30;
  var _this = this;
  rows.forEach( function(row){
    row.namespace_id = _this.user.namespace_id;
  })
  return this. knex.batchInsert(Model.table_name, rows, chunkSize)
  .returning('*')
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
