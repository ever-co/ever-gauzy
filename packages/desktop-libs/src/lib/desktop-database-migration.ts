export class DataModel {
	async createNewTable(knex) {
		try {
			await new Promise((resolve) => {
				knex.schema.hasTable('window-events').then(function (exists) {
					if (!exists) {
						return knex.schema
							.createTable('window-events', (table) => {
								table.increments();
								table.bigInteger('eventId').unique().notNullable();
								table.float('durations');
								table.bigInteger('timerId');
								table.json('data');
								table.timestamps('date');
								table.string('activityId');
							})
							.then((res) => {
								resolve(res);
							})
							.catch(() => {
								resolve(false)
							});
					}
					resolve(exists);
				})
			})

			await new Promise((resolve) => {
				knex.schema.hasTable('afk-events').then((exists) => {
					if (!exists) {
						return knex.schema
							.createTable('afk-events', (table) => {
								table.increments();
								table.bigInteger('eventId').unique().notNullable();
								table.float('durations');
								table.bigInteger('timerId');
								table.json('data');
								table.timestamps('date');
								table.string('timeSlotId');
								table.string('timeSheetId');
							})
							.then((res) => {
								resolve(res);
							})
							.catch(() => {
								resolve(false);
							});
					}
					resolve(exists);
				});
			})
			
			await new Promise((resolve) => {
				knex.schema.hasTable('timer').then(function (exists) {
					if (!exists) {
						return knex.schema
							.createTable('timer', function (table) {
								table.increments();
								table.string('day');
								table.timestamps('date');
								table.float('durations');
								table.string('projectid');
								table.string('userId');
								table.string('timeSlotId');
								table.string('timeSheetId');
								table.string('timeLogId');
							})
							.then((res) => {
								resolve(res);
							})
							.catch(() => {
								resolve(false);
							});
					}
					resolve(exists);
				});
			})

			await new Promise((resolve) => {
				knex.schema.hasColumn('window-events', 'type').then((exists) => {
					if (!exists) {
						return knex.schema
							.table('window-events', (t) => {
								t.string('type');
							})
							.then((res) => {
								resolve(res);
							})
							.catch(() => {
								resolve(false);
							});
					}
					resolve(exists);
				});
			})

			await new Promise((resolve) => {
				knex.schema.hasTable('failed-request').then((exists) => {
					if (!exists) {
						return knex.schema
							.createTable('failed-request', (table) => {
								table.increments();
								table.string('type');
								table.json('params');
								table.timestamps('createdDate');
								table.text('errorMessage');
							})
							.then((res) => {
								resolve(res);
							})
							.catch(() => {
								resolve(false);
							})
					}
					resolve(exists)
				});
			})

			await new Promise((resolve) => {
				knex.schema.hasColumn('window-events', 'eventId').then(async (exists) => {
					if (exists) {
						try {
							return await knex.schema
								.alterTable('window-events', (t) => {
									t.unique('eventId');
								})
								.then((res) => {
									resolve(res);
								});
						} catch (error) {
							resolve(exists);
						}
					}
					resolve(exists);
				});
			})

			await new Promise((resolve) => {
				knex.schema.hasColumn('afk-events', 'eventId').then(async (exists) => {
					if (exists) {
						try {
							return await knex.schema
								.alterTable('afk-events', (t) => {
									t.unique('eventId');
								})
								.then((res) => {
									resolve(res)
								});
						} catch (error) {
							resolve(exists);
						}
					}
					resolve(exists);
				});
			})
		} catch (error) {
			throw Error(`
				Failed migrate local table
				${error.message}
			`);
		}
	}
}
