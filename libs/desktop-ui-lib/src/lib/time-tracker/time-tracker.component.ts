import {
	Component,
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	AfterViewInit,
	forwardRef,
	TemplateRef
} from '@angular/core';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { ElectronService } from 'ngx-electron';
import { TimeTrackerService } from './time-tracker.service';
import * as moment from 'moment';
import { NG_VALUE_ACCESSOR } from '@angular/forms';

// Import logging for electron and override default console logging
import log from 'electron-log';
console.log = log.log;
Object.assign(console, log.functions);

@Component({
	selector: 'ngx-time-tracker',
	templateUrl: './time-tracker.component.html',
	styleUrls: ['./time-tracker.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => TimeTrackerComponent),
			multi: true
		}
	]
})
export class TimeTrackerComponent implements AfterViewInit {
	start: Boolean = false;
	timeRun: any = {
		second: '00',
		minute: '00',
		hours: '00'
	};
	TimeDay: {
		second: 0;
		minute: 0;
		hours: 0;
	};

	userData: any;
	projects: any;
	tasks: any = [];
	organizationContacts: any = [];
	organization: any = {};
	projectSelect = '';
	taskSelect = '';
	errors: any = {};
	note: String = '';
	aw: Boolean = false;
	loadingAw = false;
	iconAw = 'close-square-outline';
	statusIcon = 'success';
	awCheck = false;
	defaultAwAPI = 'http:localhost:5600';
	todayDuration = {
		hours: '00',
		minutes: '00'
	};
	userOrganization: any = {};
	lastScreenCapture: any = {};
	quitApp = false;
	organizationContactId = null;
	employeeId = null;
	argFromMain = null;
	token = null;
	apiHost = null;
	screenshots = [];
	selectedTimeSlot: any = null;
	lastTimeSlot = null;
	invalidTimeLog = null;
	loading = false;
	dialogType = {
		deleteLog: {
			name: 'deleteLog',
			message:
				'Do you really want to remove this screenshot and activities log ?'
		},
		changeClient: {
			name: 'changeClient',
			message: 'Are you sure you want to change Client ?'
		}
	};

	constructor(
		private electronService: ElectronService,
		private _cdr: ChangeDetectorRef,
		private timeTrackerService: TimeTrackerService,
		private dialogService: NbDialogService,
		private toastrService: NbToastrService
	) {
		this.electronService.ipcRenderer.on('timer_push', (event, arg) => {
			this.setTime(arg);
		});

		this.electronService.ipcRenderer.on(
			'timer_tracker_show',
			(event, arg) => {
				this.apiHost = arg.apiHost;
				this.argFromMain = arg;
				this.taskSelect = arg.taskId;
				this.projectSelect = arg.projectId;
				this.organizationContactId = arg.organizationContactId;
				this.token = arg.token;
				this.note = arg.note;
				this.aw = arg.aw && arg.aw.isAw ? arg.aw.isAw : false;
				this.getClient(arg);
				this.getProjects(arg);
				this.getTask(arg);
				this.getTodayTime(arg);
				this.getUserInfo(arg, false);

				if (arg.timeSlotId) {
					this.getLastTimeSlotImage(arg);
				}

				setTimeout(() => {
					if (!this.start) {
						this.removeInvalidTimeLog(arg);
					}
				}, 2000);
			}
		);

		this.electronService.ipcRenderer.on(
			'start_from_tray',
			async (event, arg) => {
				this.taskSelect = arg.taskId;
				this.projectSelect = arg.projectId;
				this.note = arg.note;
				this.aw = arg.aw && arg.aw.isAw ? arg.aw.isAw : false;
				this.getUserInfo(arg, true);
			}
		);

		this.electronService.ipcRenderer.on('stop_from_tray', (event, arg) => {
			if (arg && arg.quitApp) this.quitApp = true;
			this.toggleStart(false);
		});

		this.electronService.ipcRenderer.on(
			'set_project_task_reply',
			(event, arg) => {
				this.setProject(arg.projectId);
				this.setTask(arg.taskId);
				this.note = arg.note;
				this.aw = arg.aw && arg.aw.isAw ? arg.aw.isAw : false;
				_cdr.detectChanges();
			}
		);

		this.electronService.ipcRenderer.on('take_screenshot', (event, arg) => {
			log.info(`Take Screenshot:`, arg);

			const thumbSize = this.determineScreenshot(arg.screensize);
			this.electronService.desktopCapturer
				.getSources({
					types: ['screen'],
					thumbnailSize: thumbSize
				})
				.then((sources) => {
					const screens = [];
					sources.forEach(async (source, i) => {
						screens.push({
							img: source.thumbnail.toPNG(),
							name: source.name,
							id: source.display_id
						});
					});
					if (!arg.isTemp) {
						event.sender.send('save_screen_shoot', {
							screens: screens,
							timeSlotId: arg.timeSlotId,
							quitApp: this.quitApp
						});
					} else {
						event.sender.send('save_temp_screenshot', {
							screens: screens,
							timeSlotId: arg.timeSlotId,
							quitApp: this.quitApp
						});
					}
				});
		});

		this.electronService.ipcRenderer.on(
			'refresh_time_log',
			(event, arg) => {
				this.getTodayTime(arg);
			}
		);

		this.electronService.ipcRenderer.on(
			'show_last_capture',
			(event, arg) => {
				this.getLastTimeSlotImage(arg);
			}
		);

		this.electronService.ipcRenderer.on(
			'last_capture_local',
			(event, arg) => {
				console.log('Last Capture Screenshot:', arg.fullUrl);
				this.lastScreenCapture = {
					fullUrl: arg.fullUrl,
					textTime: moment().fromNow(),
					createdAt: Date.now()
				};
			}
		);

		this.electronService.ipcRenderer.on('get_user_detail', (event, arg) => {
			this.timeTrackerService.getUserDetail(arg).then((res) => {
				event.sender.send('user_detail', res);
			});
		});

		this.electronService.ipcRenderer.on('save_temp_img', (event, arg) => {
			event.sender.send('save_temp_img', arg);
		});
	}

	ngAfterViewInit(): void {
		this.electronService.ipcRenderer.send('time_tracker_ready');
	}

	async toggleStart(val) {
		this.loading = true;

		if (this.validationField()) {
			if (val) {
				await this.removeInvalidTimeLog({
					token: this.token,
					organizationId: this.userOrganization.id,
					tenantId: this.userData.tenantId,
					apiHost: this.apiHost
				});
				this.timeTrackerService
					.toggleApiStart({
						token: this.token,
						note: this.note,
						projectId: this.projectSelect,
						taskId: this.taskSelect,
						organizationId: this.userOrganization.id,
						tenantId: this.userData.tenantId,
						organizationContactId: this.organizationContactId,
						apiHost: this.apiHost
					})
					.then((res) => {
						this.start = val;
						this.startTime(res);
						this.loading = false;
					})
					.catch((error) => {
						this.loading = false;
						log.info(
							`Timer Toggle Catch: ${moment().format()}`,
							error
						);
					});
			} else {
				this.loading = false;
				this.start = val;
				this.stopTimer();
				this._cdr.detectChanges();
			}
		}
	}

	setTime(value) {
		if (!this.start) this.start = true;
		value.second = value.second % 60;
		value.minute = value.minute % 60;
		this.timeRun = {
			second:
				value.second.toString().length > 1
					? `${value.second}`
					: `0${value.second}`,
			minute:
				value.minute.toString().length > 1
					? `${value.minute}`
					: `0${value.minute}`,
			hours:
				value.hours.toString().length > 1
					? `${value.hours}`
					: `0${value.hours}`
		};
		if (value.second % 60 === 0) {
			this.electronService.ipcRenderer.send('update_tray_time_update', {
				hours: this.timeRun.hours,
				minutes: this.timeRun.minute
			});
		}

		if (value.second % 5 === 0) {
			this.pingAw(null);
			if (this.lastScreenCapture.createdAt) {
				this.lastScreenCapture.textTime = moment(
					this.lastScreenCapture.createdAt
				).fromNow();
			}
		}
		this._cdr.detectChanges();
	}

	startTime(timeLog) {
		this.electronService.ipcRenderer.send('start_timer', {
			projectId: this.projectSelect,
			taskId: this.taskSelect,
			note: this.note,
			organizationContactId: this.organizationContactId,
			aw: {
				host: this.defaultAwAPI,
				isAw: this.aw
			},
			timeLog: timeLog
		});

		this.electronService.ipcRenderer.send('update_tray_start');
	}

	stopTimer() {
		this.electronService.ipcRenderer.send('stop_timer', {
			quitApp: this.quitApp
		});
		this.electronService.ipcRenderer.send('update_tray_stop');
		this.electronService.ipcRenderer.send('update_tray_time_update', {
			hours: '00',
			minutes: '00'
		});
		this.timeRun = {
			second: '00',
			minute: '00',
			hours: '00'
		};
	}

	async getTask(arg) {
		this.tasks = await this.timeTrackerService.getTasks(arg);
	}

	async getProjects(arg) {
		this.projects = await this.timeTrackerService.getProjects(arg);
	}

	async getClient(arg) {
		this.organizationContacts = await this.timeTrackerService.getClient(
			arg
		);
	}

	async setClient(item, dialog) {
		if (this.start) {
			this.open(dialog, {
				type: this.dialogType.changeClient.name,
				val: item
			});
		} else {
			this.selectClient(item);
		}
	}

	async selectClient(item) {
		this.organizationContactId = item;
		this.electronService.ipcRenderer.send('update_project_on', {
			organizationContactId: this.organizationContactId
		});
		if (item) {
			this.projects = await this.timeTrackerService.getProjects({
				...this.argFromMain,
				organizationContactId: this.organizationContactId
			});
			this.tasks = [];
			this.projectSelect = null;
			this.taskSelect = null;
			this.errors.client = false;
		} else {
			this.projects = await this.timeTrackerService.getProjects(
				this.argFromMain
			);
		}
	}

	async setProject(item) {
		this.projectSelect = item;
		this.electronService.ipcRenderer.send('update_project_on', {
			projectId: this.projectSelect
		});
		if (item) {
			this.tasks = await this.timeTrackerService.getTasks(
				this.argFromMain
			);
			this.taskSelect = null;
			this.errors.project = false;
		} else {
			this.tasks = await this.timeTrackerService.getTasks({
				...this.argFromMain,
				projectId: this.projectSelect
			});
		}
		this.errorBind();
		this._cdr.detectChanges();
	}

	setTask(item) {
		this.taskSelect = item;
		this.electronService.ipcRenderer.send('update_project_on', {
			taskId: this.taskSelect
		});
		if (item) this.errors.task = false;
	}

	descriptionChange(e) {
		if (e) this.errors.note = false;
		this.electronService.ipcRenderer.send('update_project_on', {
			note: this.note
		});
	}

	setAW(event) {
		if (event.target.checked) {
			this.aw = true;
			this.electronService.ipcRenderer.send('set_tp_aw', {
				host: this.defaultAwAPI,
				isAw: true
			});
		} else {
			this.electronService.ipcRenderer.send('set_tp_aw', {
				host: this.defaultAwAPI,
				isAw: false
			});
			this.aw = false;
		}
		this._cdr.detectChanges();
		if (this.aw) this.pingAw(null);
		else {
			this.awCheck = false;
			this._cdr.detectChanges();
		}
	}

	pingAw(host) {
		this.loadingAw = true;
		this.awCheck = false;
		this.timeTrackerService
			.pingAw(`${host || this.defaultAwAPI}/api`)
			.then((res) => {
				this.iconAw = 'checkmark-square-outline';
				this.awCheck = true;
				this.statusIcon = 'success';
				this._cdr.detectChanges();
			})
			.catch((e) => {
				if (e.status === 200) {
					this.iconAw = 'checkmark-square-outline';
					this.awCheck = true;
					this.statusIcon = 'success';
					this._cdr.detectChanges();
					this.loadingAw = false;
				} else {
					this.loadingAw = false;
					this.iconAw = 'close-square-outline';
					this.awCheck = true;
					this.statusIcon = 'danger';
					this._cdr.detectChanges();
				}
			});
	}

	validationField() {
		this.errorBind();
		const errors = [];
		const requireField = {
			task: 'requireTask',
			project: 'requireProject',
			client: 'requireClient',
			note: 'requireDescription'
		};
		Object.keys(this.errors).forEach((key) => {
			if (this.errors[key] && this.userOrganization[requireField[key]])
				errors.push(true);
		});
		return errors.length === 0;
	}

	errorBind() {
		if (!this.projectSelect && this.userOrganization.requireProject)
			this.errors.project = true;
		if (!this.taskSelect && this.userOrganization.requireTask)
			this.errors.task = true;
		if (!this.organizationContactId && this.userOrganization.requireClient)
			this.errors.client = true;
		if (!this.note && this.userOrganization.requireDescription)
			this.errors.note = true;
	}

	doshoot() {
		this.electronService.ipcRenderer.send('screen_shoot');
	}

	determineScreenshot(screensize) {
		const maxDimension = Math.max(screensize.width, screensize.height);
		console.log(maxDimension);

		return {
			width: maxDimension * window.devicePixelRatio,
			height: maxDimension * window.devicePixelRatio
		};
	}

	getTodayTime(arg) {
		this.timeTrackerService.getTimeLogs(arg).then((res: any) => {
			if (res && res.length > 0) {
				this.countDurationToday(res);
			}
		});
	}

	countDurationToday(items) {
		const workToday = {
			hours: 0,
			seconds: 0
		};
		items.forEach((item) => {
			const stopItem = item.stoppedAt ? item.stoppedAt : new Date();
			const itemDurationHours = moment(stopItem).diff(
				moment(item.startedAt),
				'hours'
			);
			const itemDurationSeconds = moment(stopItem).diff(
				moment(item.startedAt),
				'seconds'
			);
			workToday.hours += itemDurationHours;
			workToday.seconds += itemDurationSeconds;
		});
		this.todayDuration = {
			hours: this.formatingDuration('hours', workToday.hours),
			minutes: this.formatingDuration(
				'minutes',
				Math.floor(workToday.seconds / 60)
			)
		};
		this._cdr.detectChanges();
	}

	formatingDuration(timeEntity, val) {
		switch (timeEntity) {
			case 'hours': {
				return val.toString().length > 1 ? `${val}` : `0${val}`;
			}
			case 'minutes': {
				const minteBackTime = val % 60;
				return val.toString().length > 1
					? `${minteBackTime}`
					: `0${minteBackTime}`;
			}
			default:
				return '00';
		}
	}

	getLastTimeSlotImage(arg) {
		this.timeTrackerService
			.getTimeSlot(arg)
			.then((res: any) => {
				console.log(
					'Get Last Timeslot Image Response:',
					res.screenshots
				);
				if (res.screenshots && res.screenshots.length > 0) {
					this.lastScreenCapture = res.screenshots[0];
					this.screenshots = res.screenshots;
					this.lastTimeSlot = res;
				} else {
					this.lastScreenCapture = {};
				}
				if (this.lastScreenCapture.createdAt) {
					this.lastScreenCapture.textTime = moment(
						this.lastScreenCapture.createdAt
					).fromNow();
				} else {
					this.lastScreenCapture = {};
				}
				this._cdr.detectChanges();
			})
			.catch((error) => {
				console.log('get last timeslot image error', error);
			});
	}

	getUserInfo(arg, start) {
		this.timeTrackerService.getUserDetail(arg).then((res: any) => {
			if (res.employee && res.employee.organization) {
				this.userData = res;
				this.userOrganization = res.employee.organization;
				if (start) {
					this.toggleStart(true);
				}
				this._cdr.detectChanges();
			}
		});
	}

	showImage() {
		this.electronService.ipcRenderer.send('show_image', this.screenshots);
	}

	open(dialog: TemplateRef<any>, option) {
		this.selectedTimeSlot = this.lastTimeSlot;
		this.dialogService
			.open(dialog, {
				context: this.dialogType[option.type].message
			})
			.onClose.subscribe((selectedOption) => {
				if (selectedOption) {
					switch (option.type) {
						case this.dialogType[option.type].name:
							this.selectClient(option.val);
							break;
						case this.dialogType[option.type].name:
							this.deleteTimeSlot();
							break;
						default:
							break;
					}
				}
			});
	}

	deleteTimeSlot() {
		this.timeTrackerService
			.deleteTimeSlot({
				...this.argFromMain,
				timeSlotId: this.selectedTimeSlot.id
			})
			.then((res) => {
				this.getLastTimeSlotImage(this.argFromMain);
				this.toastrService.show(
					`Successfully remove last screenshot and activities`,
					`Success`,
					{ status: 'success' }
				);
			})
			.catch((e) => {
				console.log('error on delte', e);
				this.toastrService.show(`${e.statusText}`, `Warning`, {
					status: 'danger'
				});
			});
	}

	removeInvalidTimeLog(arg) {
		return this.timeTrackerService
			.getInvalidTimeLog(arg)
			.then(async (res: any) => {
				if (res && res.length > 0) {
					this.invalidTimeLog = res.filter((x) => !x.stoppedAt);
					console.log('Invalid Timelog:', this.invalidTimeLog);
					if (this.invalidTimeLog && this.invalidTimeLog.length > 0) {
						await Promise.all(
							this.invalidTimeLog.map(async (x) => {
								await this.timeTrackerService.deleteInvalidTimeLog(
									{ ...arg, timeLogId: x.id }
								);
								return x;
							})
						);
						return res;
					}
					return res;
				}
				return res;
			});
	}
}
