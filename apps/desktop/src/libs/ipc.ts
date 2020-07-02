import { ipcMain } from 'electron';
import { TimerData } from '../local-data/timer';
export function ipcMainHandler(store, startServer, knex) {
	ipcMain.on('start_server', (event, arg) => {
		global.variableGlobal = {
			API_BASE_URL: arg.serverUrl
				? arg.serverUrl
				: arg.port
				? `http://localhost:${arg.port}`
				: 'http://localhost:3000'
		};
		startServer(arg);
	});

	ipcMain.on('data_push_activity', (event, arg) => {
		arg.windowEvent.forEach((item) => {
			const events = {
				eventId: item.id,
				timerId: arg.timerId,
				durations: item.duration,
				data: JSON.stringify(item.data)
			};
			TimerData.insertWindowEvent(knex, events);
		});
	});
}
