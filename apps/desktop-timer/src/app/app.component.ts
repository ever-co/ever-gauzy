import { Component, OnInit } from '@angular/core';
import { ElectronService } from 'ngx-electron';
import { AppService } from './app.service';

@Component({
	selector: 'gauzy-root',
	template: '<router-outlet></router-outlet>',
	styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
	constructor(
		private electronService: ElectronService,
		private appService: AppService
	) {
		this.electronService.ipcRenderer.on('collect_data', (event, arg) => {
			this.appService
				.collectevents(arg.tpURL, arg.tp, arg.start, arg.end)
				.then((res) => {
					event.sender.send('data_push_activity', {
						timerId: arg.timerId,
						windowEvent: res,
						type: 'APP'
					});
				});
		});

		this.electronService.ipcRenderer.on('collect_afk', (event, arg) => {
			this.appService
				.collectAfk(arg.tpURL, arg.tp, arg.start, arg.end)
				.then((res) => {
					event.sender.send('data_push_afk', {
						timerId: arg.timerId,
						start: arg.start,
						afk: res
					});
				});
		});

		this.electronService.ipcRenderer.on(
			'collect_chrome_activities',
			(event, arg) => {
				this.appService
					.collectChromeActivityFromAW(arg.tpURL, arg.start, arg.end)
					.then((res) => {
						event.sender.send('data_push_activity', {
							timerId: arg.timerId,
							windowEvent: res,
							type: 'URL'
						});
					});
			}
		);

		this.electronService.ipcRenderer.on(
			'collect_firefox_activities',
			(event, arg) => {
				this.appService
					.collectFirefoxActivityFromAw(arg.tpURL, arg.start, arg.end)
					.then((res) => {
						event.sender.send('data_push_activity', {
							timerId: arg.timerId,
							windowEvent: res,
							type: 'URL'
						});
					});
			}
		);

		this.electronService.ipcRenderer.on('set_time_sheet', (event, arg) => {
			this.appService.pushToTimesheet(arg).then((res: any) => {
				arg.timesheetId = res.id;
				this.appService.setTimeLog(arg).then((result: any) => {
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
				this.appService.updateToTimeSheet(arg).then((res: any) => {
					this.appService.updateTimeLog(arg);
				});
			}
		);

		this.electronService.ipcRenderer.on(
			'set_auth_user',
			(event, arg) => {}
		);

		this.electronService.ipcRenderer.on('set_time_slot', (event, arg) => {
			console.log('Set Time Slot:', arg);

			this.appService.pushToTimeslot(arg).then((res: any) => {
				if (arg.idsAw) {
					event.sender.send('remove_aw_local_data', {
						idsAw: arg.idsAw
					});
				}
				if (arg.idsWakatime) {
					event.sender.send('remove_wakatime_local_data', {
						idsWakatime: arg.idsWakatime
					});
				}
				if (arg.idAfk) {
					event.sender.send('remove_afk_local_Data', {
						idAfk: arg.idAfk
					});
				}
				const timeLogs = res.timeLogs;
				event.sender.send('return_time_slot', {
					timerId: arg.timerId,
					timeSlotId: res.id,
					quitApp: arg.quitApp,
					timeLogs: timeLogs
				});
			});
		});

		this.electronService.ipcRenderer.on(
			'update_time_slot',
			(event, arg) => {
				this.appService.updateToTimeSlot(arg);
			}
		);

		this.electronService.ipcRenderer.on('set_activity', (event, arg) => {
			this.appService.pushToActivity(arg).then((res: any) => {
				event.sender.send('return_activity', {
					activityIds: arg.sourceIds
				});
			});
		});

		this.electronService.ipcRenderer.on(
			'update_to_activity',
			(event, arg) => {
				this.appService.updateToActivity(arg);
			}
		);

		this.electronService.ipcRenderer.on('set_time_log', (event, arg) => {
			this.appService.setTimeLog(arg).then((res: any) => {
				event.sender.send('return_time_log', {
					timerId: arg.timerId,
					timeLogId: res.id
				});
			});
		});

		this.electronService.ipcRenderer.on(
			'update_time_log_stop',
			(event, arg) => {
				console.log('time log stop');
				this.appService.updateTimeLog(arg);
			}
		);

		this.electronService.ipcRenderer.on('time_toggle', (event, arg) => {
			this.appService.toggleApi(arg).then((res) => {
				event.sender.send('return_toggle_api', {
					result: res,
					timerId: arg.timerId
				});
			});
		});

		this.electronService.ipcRenderer.on(
			'update_toggle_timer',
			(event, arg) => {
				this.appService.toggleApi(arg);
			}
		);

		this.electronService.ipcRenderer.on('server_ping', (event, arg) => {
			const pinghost = setInterval(() => {
				this.appService
					.pingServer(arg)
					.then((res) => {
						console.log('Server Found');
						event.sender.send('server_is_ready');
						clearInterval(pinghost);
					})
					.catch((e) => {
						console.log('error', e.status);
						if (e.status === 404) {
							event.sender.send('server_is_ready');
							clearInterval(pinghost);
						}
					});
			}, 1000);
		});

		this.electronService.ipcRenderer.on(
			'upload_screen_shot',
			(event, arg) => {
				this.appService.uploadScreenCapture(arg).then((res) => {
					console.log('screen upload', res);
				});
			}
		);

		this.electronService.ipcRenderer.on(
			'server_ping_restart',
			(event, arg) => {
				const pinghost = setInterval(() => {
					this.appService
						.pingServer(arg)
						.then((res) => {
							console.log('server found');
							event.sender.send('server_already_start');
							clearInterval(pinghost);
						})
						.catch((e) => {
							console.log('error', e.status);
							if (e.status === 404) {
								event.sender.send('server_already_start');
								clearInterval(pinghost);
							}
						});
				}, 3000);
			}
		);
	}

	ngOnInit(): void {
		console.log('On Init');
		this.electronService.ipcRenderer.send('app_is_init');
	}
}
