
exports.up = function(knex, Promise) {
  return knex.schema.alterTable('action_log', function(table) {
    table.dropForeign('userId')
    table.foreign('userId').references('users.id').onDelete('cascade');
  });
};

exports.down = function(knex, Promise) {

};
