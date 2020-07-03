import moment, { now } from 'moment';
import { Tray } from 'electron';
import { TimerData } from '../local-data/timer';
export default class Timerhandler {
	timeRecordMinute = 0;
	timeRecordHours = 0;
	timeStart = null;
	trayTime: Tray;
	intevalTimer = null;
	intervalUpdateTime = null;
	lastTimer: any;

	async startTimer(win2, knex) {
		this.timeStart = moment();
		this.lastTimer = await TimerData.createTimer(knex, {
			day: moment().format('YYYY-MM-DD'),
			updated_at: moment(),
			created_at: moment(),
			durations: 0,
			projectid: null,
			userId: null
		});
		this.intevalTimer = setInterval(() => {
			const now = moment();
			TimerData.updateDurationOfTimer(knex, {
				id: this.lastTimer[0],
				durations: now.diff(moment(this.timeStart), 'milliseconds')
			});
			console.log('run time');
			win2.webContents.send('collect_data', {
				start: this.timeStart.utc().format(),
				end: moment().utc().format(),
				timerId: this.lastTimer[0]
			});
			this.calculateTimeRecord();
		}, 1000);
	}

	calculateTimeRecord() {
		const now = moment();
		this.timeRecordHours = now.diff(moment(this.timeStart), 'hours');
		this.timeRecordMinute = now.diff(moment(this.timeStart), 'minutes');
	}

	updateTime(menuItem, trayApp) {
		this.intervalUpdateTime = setInterval(() => {
			this.trayTime = trayApp;
			console.log(
				`Time= ${this.timeRecordHours} : ${this.timeRecordMinute}`
			);
			const timeInMinute =
				this.timeRecordMinute % 60 > 0
					? this.timeRecordMinute % 60
					: this.timeRecordMinute;
			const timeMenu = menuItem.menu.getMenuItemById('0');
			timeMenu.label = `Now tracking time - ${this.timeRecordHours}h ${timeInMinute}m`;
			this.trayTime.setContextMenu(menuItem.menu);
		}, 60 * 1000 + 1000);
	}

	stopTime() {
		clearInterval(this.intevalTimer);
		clearInterval(this.intervalUpdateTime);
	}
}
