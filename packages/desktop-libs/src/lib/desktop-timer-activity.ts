import moment from 'moment';
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
			delete query.updated_at;
			delete query.activityId;
			// delete query.timerId;
			knex('window-events')
				.where({
					eventId: query.eventId
				})
				.update(query)
				.then(true);
		}
	},
	updateWindowEventUpload: (knex, data) => {
		return knex('window-events')
			.where({
				eventId: data.eventId
			})
			.update({
				activityId: data.activityId
			})
			.then((res) => res);
	},
	deleteWindowEventAfterSended: (knex, data) => {
		return knex('window-events')
			.whereIn('id', data.activityIds)
			.del()
			.then((res) => {
				return res;
			});
	},
	updateTimerUpload: (knex, data) => {
		return knex('timer')
			.where({
				id: data.id
			})
			.update(data)
			.then((res) => res);
	},

	getTimer: (knex, id) => {
		return knex('timer')
			.where({
				id: id
			})
			.then((res) => res);
	},

	getAfk: (knex, timerId) => {
		return knex('afk-events')
			.where({
				timerId: timerId
			})
			.then((res) => res);
	},

	deleteAfk: (knex, data) => {
		return knex('afk-events')
			.where({
				id: data.idAfk
			})
			.del()
			.then((res) => res);
	},

	getWindowEvent: (knex, timerId) => {
		return knex('window-events')
			.where({
				timerId: timerId
			})
			.then((res) => res);
	},

	insertAfkEvent: async (knex, query) => {
		const eventExist = await knex('afk-events').where({
			eventId: query.eventId
		});
		if (eventExist.length === 0) {
			knex('afk-events').insert(query).then(true);
		} else {
			delete query.updated_at;
			delete query.timeSlotId;
			// delete query.timerId;
			knex('afk-events')
				.where({
					eventId: query.eventId
				})
				.update(query)
				.then(true);
		}
	},

	getLastTimer: async (knex, appInfo) => {
		const result = await knex('timer')
			.where({
				projectId: appInfo.projectId,
				userId: appInfo.employeeId
			})
			.orderBy('created_at', 'desc')
			.limit(1);
		return result;
	},

	saveFailedRequest: async (knex, value) => {
		const result = await knex('failed-request')
			.insert(
				{
					type: value.type,
					params: value.params,
					errorMessage: value.message,
					created_at: moment(),
					updated_at: moment()
				},
				['id']
			)
			.then((res) => res);
		return result;
	}
};
