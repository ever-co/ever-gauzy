export const TimerData = {
	createTimer: (knex, query) => {
		return knex('timer')
			.insert(query, ['id'])
			.then((res) => res);
	},
	updateDurationOfTimer: (knex, query) => {
		return knex('timer')
			.where({
				id: query.id
			})
			.update({
				durations: query.durations
			})
			.then((res) => res);
	},
	insertWindowEvent: async (knex, query) => {
		const eventExist = await knex('window-events').where({
			eventId: query.eventId
		});
		if (eventExist.length === 0) {
			knex('window-events').insert(query).then(true);
		} else {
			knex('window-events')
				.where({
					eventId: query.eventId
				})
				.update(query)
				.then(true);
		}
	}
};
