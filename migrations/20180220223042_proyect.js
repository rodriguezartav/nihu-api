exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('project', function(table) {
    table.increments();
    table.string('name').notNullable();
    table.string('type');
    table.string('namespace_id').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  })
};

exports.down = function(knex, Promise) {
  return knex.schema.dropTable("project");
};
