import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ElectronService } from 'ngx-electron';
import { AppService } from './app.service';

@Component({
	selector: 'gauzy-root',
	template: '<router-outlet></router-outlet>'
})
export class AppComponent implements OnInit {
	constructor(
		private router: Router,
		private electronService: ElectronService,
		private appService: AppService
	) {
		this.electronService.ipcRenderer.on('collect_data', (event, arg) => {
			appService
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
			appService
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
				appService
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
				appService
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
			appService
				.pushTotimeslot(arg)
				.then((res: any) => {
					if (res.id) {
						event.sender.send('remove_aw_local_data', {
							idsAw: arg.idsAw
						});
						event.sender.send('remove_wakatime_local_data', {
							idsWakatime: arg.idsWakatime
						});
						if (arg.idAfk) {
							event.sender.send('remove_afk_local_Data', {
								idAfk: arg.idAfk
							});
						}
						event.sender.send('return_time_slot', {
							timerId: arg.timerId,
							timeSlotId: res.id,
							quitApp: arg.quitApp
						});
					}
				})
				.catch((e) => {
					event.sender.send('failed_save_time_slot', {
						params: e.error.params,
						message: e.message
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
			appService.pushToActivity(arg).then((res: any) => {
				event.sender.send('return_activity', {
					activityIds: arg.sourceIds
				});
			});
		});

		this.electronService.ipcRenderer.on(
			'update_to_activity',
			(event, arg) => {
				appService.updateToActivity(arg);
			}
		);

		this.electronService.ipcRenderer.on('set_time_log', (event, arg) => {
			appService.setTimeLog(arg).then((res: any) => {
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
				appService.updateTimeLog(arg);
			}
		);

		this.electronService.ipcRenderer.on('time_toggle', (event, arg) => {
			appService.toggleApi(arg).then((res) => {
				event.sender.send('return_toggle_api', {
					result: res,
					timerId: arg.timerId
				});
			});
		});

		this.electronService.ipcRenderer.on(
			'update_toggle_timer',
			(event, arg) => {
				appService.toggleApi(arg);
			}
		);

		this.electronService.ipcRenderer.on('server_ping', (event, arg) => {
			const pinghost = setInterval(() => {
				appService
					.pingServer(arg)
					.then((res) => {
						console.log('server found');
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
				appService.uploadScreenCapture(arg).then((res) => {
					console.log('screen upload', res);
				});
			}
		);

		this.electronService.ipcRenderer.on(
			'server_ping_restart',
			(event, arg) => {
				const pinghost = setInterval(() => {
					appService
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
		console.log('on init');
		this.electronService.ipcRenderer.send('app_is_init');
	}
}
