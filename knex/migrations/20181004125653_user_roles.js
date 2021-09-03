
exports.up = function(knex, Promise) {
  return knex.schema.createTable('user_roles', function(table) {
    table.increments();
    table.integer('userId').unsigned().notNullable().references('id').inTable('users');
    table.integer('userId').unsigned().notNullable().references('id').inTable('users');
    table.integer('roleId').unsigned().notNullable().references('id').inTable('roles');
    table.timestamp('createdAt').defaultTo(knex.fn.now());
    table.timestamp('updatedAt').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex, Promise) {
  knex.schema.dropTable('user_roles');
};
