export default class DataModel {
	createNewTable(knex) {
		knex.schema.hasTable('window-events').then(function (exists) {
			if (!exists) {
				knex.schema
					.createTable('window-events', (table) => {
						table.increments();
						table.bigInteger('eventId');
						table.float('durations');
						table.bigInteger('timerId');
						table.json('data');
						table.timestamps('date');
						table.string('activityId');
					})
					.then((res) => res);
			}
		});
		knex.schema.hasTable('afk-events').then((exists) => {
			if (!exists) {
				knex.schema
					.createTable('afk-events', (table) => {
						table.increments();
						table.bigInteger('eventId');
						table.float('durations');
						table.bigInteger('timerId');
						table.json('data');
						table.timestamps('date');
						table.string('timeSlotId');
						table.string('timeSheetId');
					})
					.then((res) => res);
			}
		});
		knex.schema.hasTable('timer').then(function (exists) {
			if (!exists) {
				knex.schema
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
					.then((res) => res);
			}
		});
	}
}
