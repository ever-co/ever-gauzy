import moment from 'moment';
import { Timer, TimerService } from './offline';

const timerService = new TimerService();
export const TimerData = {
	createTimer: async (knex, query) => {
		const timer = new Timer(query);
		await timerService.save(timer);
	},
	updateDurationOfTimer: async (knex, query) => {
		const timer = new Timer(query);
		await timerService.update(timer);
	},
	insertWindowEvent: async (knex, query, retry = 0) => {
		try {
			const sql = `${await knex('window-events').insert(query).toQuery()} 
			ON CONFLICT (eventId) 
			DO UPDATE SET
			timerId=EXCLUDED.timerId,
			duration=EXCLUDED.duration,
			data=EXCLUDED.data,
			updated_at=EXCLUDED.updated_at,
			type=EXCLUDED.type
			;`;
			return await knex.raw(sql);
		} catch (error) {
			if (
				error.message
					.toLowerCase()
					.indexOf(
						'Knex: Timeout acquiring a connection'.toLowerCase()
					) > -1
			) {
				if (retry < 3) {
					await TimerData.wait(3000);
					return await TimerData.insertWindowEvent(
						knex,
						query,
						retry + 1
					);
				}
			}
			console.log('error on insert window-events');
			throw error;
		}
	},
	updateWindowEventUpload: async (knex, data) => {
		return await knex('window-events')
			.where('eventId', data.eventId)
			.update({
				activityId: data.activityId,
			});
	},
	deleteWindowEventAfterSended: async (knex, data) => {
		return await knex('window-events')
			.whereIn('id', data.activityIds)
			.del();
	},
	updateTimerUpload: async (knex, data) => {
		const timer = new Timer(data);
		await timerService.update(timer);
	},
	getTimer: async (knex, timerId) => {
		return await knex('window-events').where('timerId', timerId);
	},
	getAfk: async (knex, timerId) => {
		return await knex('window-events').where({
			timerId: timerId,
			type: 'AFK',
		});
	},
	deleteAfk: async (knex, data) => {
		return await knex('afk-events')
			.where({
				id: data.idAfk,
			})
			.del();
	},
	getWindowEvent: async (knex, timerId) => {
		return await knex('window-events')
			.whereNot({
				type: 'AFK',
			})
			.andWhere({
				timerId: timerId,
			});
	},
	insertAfkEvent: async (knex, query, retry = 0) => {
		try {
			const sql = `${await knex('afk-events').insert(query).toQuery()} 
			ON CONFLICT (eventId) 
			DO UPDATE SET
			duration=EXCLUDED.duration,
			timerId=EXCLUDED.timerId,
			data=EXCLUDED.data,
			updated_at=EXCLUDED.updated_at,
			timeSlotId=EXCLUDED.timeSlotId,
			timeSheetId=EXCLUDED.timeSheetId
			;`;
			await knex.raw(sql);
		} catch (error) {
			if (
				error.message
					.toLowerCase()
					.indexOf(
						'Knex: Timeout acquiring a connection'.toLowerCase()
					) > -1
			) {
				if (retry < 3) {
					await TimerData.wait(3000);
					return await TimerData.insertAfkEvent(
						knex,
						query,
						retry + 1
					);
				}
			}
			console.log('error on insert afk-events');
			throw error;
		}
	},
	getLastTimer: async (knex, appInfo) => {
		return await timerService.findLastOne();
	},
	getLastCaptureTimeSlot: async (knex, info) => {
		return await timerService.findLastCapture();
	},
	saveFailedRequest: async (knex, value) => {
		return await knex('failed-request').insert(
			{
				type: value.type,
				params: value.params,
				errorMessage: value.message,
				created_at: moment(),
				updated_at: moment(),
			},
			['id']
		);
	},
	wait(ms: number) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	},
};
