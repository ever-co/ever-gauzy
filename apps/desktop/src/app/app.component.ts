import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ElectronService } from 'ngx-electron';
import { AppService } from './app.service';

@Component({
	selector: 'gauzy-root',
	template: '<router-outlet></router-outlet>'
})
export class AppComponent {
	constructor(
		private router: Router,
		private electronService: ElectronService,
		private appService: AppService
	) {
		this.electronService.ipcRenderer.on('collect_data', (event, arg) => {
			console.log('aw', arg);
			appService
				.collectevents(arg.tpURL, arg.tp, arg.start, arg.end)
				.then((res) => {
					console.log('result', res);
					event.sender.send('data_push_activity', {
						timerId: arg.timerId,
						windowEvent: res
					});
				});
		});

		this.electronService.ipcRenderer.on('collect_afk', (event, arg) => {
			appService
				.collectAfk(arg.tpURL, arg.tp, arg.start, arg.end)
				.then((res) => {
					event.sender.send('data_push_afk', {
						timerId: arg.timerId,
						afk: res
					});
				});
		});

		this.electronService.ipcRenderer.on('set_time_sheet', (event, arg) => {
			appService.pushTotimesheet(arg).then((res: any) => {
				arg.timesheetId = res.id;
				appService.setTimeLog(arg).then((result: any) => {
					event.sender.send('return_time_sheet', {
						timerId: arg.timerId,
						timeSheetId: res.id,
						timeLogId: result.id
					});
				});
			});
		});

		this.electronService.ipcRenderer.on(
			'update_time_sheet',
			(event, arg) => {
				appService.updateToTimeSheet(arg).then((res: any) => {
					appService.updateTimeLog(arg);
				});
			}
		);

		this.electronService.ipcRenderer.on(
			'set_auth_user',
			(event, arg) => {}
		);

		this.electronService.ipcRenderer.on('set_time_slot', (event, arg) => {
			appService.pushTotimeslot(arg).then((res: any) => {
				event.sender.send('return_time_slot', {
					timeSlotId: res.id,
					timerId: arg.timerId
				});
			});
		});

		this.electronService.ipcRenderer.on(
			'update_time_slot',
			(event, arg) => {
				appService.updateToTimeSlot(arg);
			}
		);

		this.electronService.ipcRenderer.on('set_activity', (event, arg) => {
			console.log('addd activity');
			appService.pushToActivity(arg).then((res: any) => {
				event.sender.send('return_activity', {
					activityId: res.id,
					eventId: arg.eventId
				});
			});
		});

		this.electronService.ipcRenderer.on(
			'update_to_activity',
			(event, arg) => {
				console.log('update aCtivity');
				appService.updateToActivity(arg);
			}
		);
	}
}
