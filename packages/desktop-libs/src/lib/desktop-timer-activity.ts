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
	insertWindowEvent: async (knex, query, retry = 0) => {
		try {
			const sql = `${knex('window-events')
			.insert(query)
			.toQuery()} 
			ON CONFLICT (eventId) 
			DO UPDATE SET
			timerId=EXCLUDED.timerId,
			durations=EXCLUDED.durations,
			data=EXCLUDED.data,
			updated_at=EXCLUDED.updated_at,
			type=EXCLUDED.type
			;`;
			return await knex.raw(sql);
		} catch (error) {
			if (error.message.toLowerCase().indexOf('Knex: Timeout acquiring a connection'.toLowerCase()) > -1) {
				if (retry < 3) {
					await TimerData.wait(3000);
					return await TimerData.insertWindowEvent(knex, query, retry + 1);
				}
			}
			console.log('error on insert window-events');
			throw error;
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
		return await knex('timer')
			.where({
				id: id
			});
	},
	getAfk: async (knex, timerId) => {
		return await knex('afk-events')
			.where({
				timerId: timerId
			});
	},
	deleteAfk: async (knex, data) => {
		return await knex('afk-events')
			.where({
				id: data.idAfk
			})
			.del();
	},
	getWindowEvent: async (knex, timerId) => {
		return await knex('window-events')
			.where({
				timerId: timerId
			});
	},
	insertAfkEvent: async (knex, query, retry = 0) => {
		try {
			const sql = `${knex('afk-events')
			.insert(query)
			.toQuery()} 
			ON CONFLICT (eventId) 
			DO UPDATE SET
			durations=EXCLUDED.durations,
			timerId=EXCLUDED.timerId,
			data=EXCLUDED.data,
			updated_at=EXCLUDED.updated_at,
			timeSlotId=EXCLUDED.timeSlotId,
			timeSheetId=EXCLUDED.timeSheetId
			;`;
			await knex.raw(sql);
		} catch (error) {
			if (error.message.toLowerCase().indexOf('Knex: Timeout acquiring a connection'.toLowerCase()) > -1) {
				if (retry < 3) {
					await TimerData.wait(3000);
					return await TimerData.insertAfkEvent(knex, query, retry + 1);
				}
			}
			console.log('error on insert afk-events');
			throw error;
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
		return await knex('failed-request')
			.insert(
				{
					type: value.type,
					params: value.params,
					errorMessage: value.message,
					created_at: moment(),
					updated_at: moment()
				},
				['id']
			);
	},
	wait(ms: number) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
};
