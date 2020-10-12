
exports.up = function(knex, Promise) {
  return knex.schema.alterTable('user_roles', function(table) {
    table.dropForeign('userId')
    table.foreign('userId').references('users.id').onDelete('cascade');
  });

};

exports.down = function(knex, Promise) {

};
