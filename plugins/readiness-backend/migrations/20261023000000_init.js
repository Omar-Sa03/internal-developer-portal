// @ts-check

/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('readiness_evaluations', table => {
    table.comment('Production readiness scores per catalog entity over time');
    table.increments('id');
    table.string('entity_ref').notNullable();
    table
      .integer('score')
      .nullable()
      .comment('0-100, null if nothing could be evaluated');
    table.string('grade', 1).nullable();
    table.text('checks').notNullable().comment('JSON array of check results');
    table.timestamp('evaluated_at', { useTz: true }).notNullable();
    table.index(['entity_ref', 'evaluated_at'], 'readiness_entity_time_idx');
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTable('readiness_evaluations');
};
