import moment from 'moment';
export const TimerData = {
	createTimer: async (knex, query) => {
		return await knex('timer').insert(query, ['id']);
	},
	updateDurationOfTimer: async (knex, query) => {
		return await knex('timer')
			.where({
				id: query.id
			})
			.update({
				durations: query.durations
			});
	},
	insertWindowEvent: async (knex, query) => {
		const eventExist = await knex('window-events').where({
			eventId: query.eventId
		});
		if (eventExist.length === 0) {
			await knex('window-events').insert(query);
		} else {
			delete query.updated_at;
			delete query.activityId;
			// delete query.timerId;
			await knex('window-events').where({ eventId: query.eventId }).update(query);
		}
	},
	updateWindowEventUpload: async (knex, data) => {
		return await knex('window-events')
			.where({
				eventId: data.eventId
			})
			.update({
				activityId: data.activityId
			});
	},
	deleteWindowEventAfterSended: async (knex, data) => {
		return await knex('window-events')
			.whereIn('id', data.activityIds)
			.del();
	},
	updateTimerUpload: async (knex, data) => {
		return await knex('timer')
			.where({
				id: data.id
			})
			.update(data);
	},
	getTimer: async (knex, id) => {
		return await knex('timer').where({ id: id });
	},
	getAfk: async (knex, timerId) => {
		return await knex('afk-events').where({ timerId: timerId });
	},
	deleteAfk: async (knex, data) => {
		return await knex('afk-events').where({ id: data.idAfk }).del();
	},
	getWindowEvent: async (knex, timerId) => {
		return await knex('window-events').where({ timerId: timerId });
	},
	insertAfkEvent: async (knex, query) => {
		const eventExist = await knex('afk-events').where({
			eventId: query.eventId
		});
		if (eventExist.length === 0) {
			await knex('afk-events').insert(query);
		} else {
			delete query.updated_at;
			delete query.timeSlotId;
			// delete query.timerId;
			await knex('afk-events')
				.where({
					eventId: query.eventId
				})
				.update(query);
		}
	},
	getLastTimer: async (knex, appInfo) => {
		return await knex('timer')
			.where({
				projectId: appInfo.projectId,
				userId: appInfo.employeeId
			})
			.orderBy('created_at', 'desc')
			.limit(1);
	},
	getLastCaptureTimeSlot: async (knex, info) => {
		return await knex('timer')
			.where('userId', info.employeeId)
			.where((qb) => qb.orWhereNotNull("timeSlotId"))
			.orderBy('created_at', 'desc')
			.limit(1);
	},
	saveFailedRequest: async (knex, value) => {
		return await knex('failed-request').insert(
			{
				type: value.type,
				params: value.params,
				errorMessage: value.message,
				created_at: moment(),
				updated_at: moment()
			},
			['id']
		);
	}
};
