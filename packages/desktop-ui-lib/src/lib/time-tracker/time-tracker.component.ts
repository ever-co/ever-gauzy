import {
	Component,
	ChangeDetectionStrategy,
	AfterViewInit,
	forwardRef,
	TemplateRef,
	ElementRef,
	ViewChild,
	NgZone,
	OnInit
} from '@angular/core';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { ElectronService } from 'ngx-electron';
import { TimeTrackerService } from './time-tracker.service';
import * as moment from 'moment';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import * as _ from 'underscore';
import { CustomRenderComponent } from './custom-render-cell.component';
import { LocalDataSource } from 'ng2-smart-table';
import { DomSanitizer } from '@angular/platform-browser';
import { BehaviorSubject } from 'rxjs';

// Import logging for electron and override default console logging
const log = window.require('electron-log');
console.log = log.log;
Object.assign(console, log.functions);

@Component({
	selector: 'ngx-desktop-time-tracker',
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
export class TimeTrackerComponent implements OnInit, AfterViewInit {
	@ViewChild('dialogOpenBtn') btnDialogOpen: ElementRef<HTMLElement>;
	start: Boolean = false;
	timeRun: BehaviorSubject<any> = new BehaviorSubject({
		second: '00',
		minute: '00',
		hours: '00'
	});
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
	userPermission: any = [];
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
	appSetting = null;
	isExpand = false;
	timerWindow = 'col-12 no-padding full-width';
	dialogType = {
		deleteLog: {
			name: 'deleteLog',
			message:
				'Do you really want to remove this screenshot and activities log ?'
		},
		changeClient: {
			name: 'changeClient',
			message: 'Are you sure you want to change Client ?'
		},
		timeTrackingOption: {
			name: 'timeTrackingOption',
			message: 'Your timer was running when PC was locked. Resume timer?'
		}
	};

	timerStatus: any;

	expandIcon = 'arrow-right';
	tableHeader = {
		columns: {
			title: {
				title: 'Task',
				type: 'custom',
				renderComponent: CustomRenderComponent
			},
			dueDate: {
				title: 'Due',
				type: 'text',
				valuePrepareFunction: (due) => {
					return moment(due).format('YYYY-MM-DD');
				}
			}
		},
		hideSubHeader: true,
		actions: false,
		noDataMessage: 'No Tasks Found'
	};

	tableData = [];
	sourceData: LocalDataSource;
	isTrackingEnabled = true;

	isAddTask = false;
	sound: any = null;

	constructor(
		private electronService: ElectronService,
		private timeTrackerService: TimeTrackerService,
		private dialogService: NbDialogService,
		private toastrService: NbToastrService,
		private sanitize: DomSanitizer,
		private _ngZone: NgZone
	) {}

	ngOnInit(): void {
		this.electronService.ipcRenderer.on('timer_push', (event, arg) =>
			this._ngZone.run(() => {
				this.setTime(arg);
			})
		);
		this.sourceData = new LocalDataSource(this.tableData);

		this.electronService.ipcRenderer.on(
			'timer_tracker_show',
			(event, arg) =>
				this._ngZone.run(() => {
					this.apiHost = arg.apiHost;
					this.argFromMain = arg;
					this.taskSelect = arg.taskId;
					this.projectSelect = arg.projectId;
					this.organizationContactId = arg.organizationContactId;
					this.token = arg.token;
					this.note = arg.note;
					this.aw = arg.aw && arg.aw.isAw ? arg.aw.isAw : false;
					this.appSetting = arg.settings;
					this.getClient(arg);
					this.getProjects(arg);
					this.getTask(arg);
					this.getTodayTime(arg);
					this.getUserInfo(arg, false);

					(async () => {
						if (arg.timeSlotId) {
							this.getLastTimeSlotImage(arg);
						}
					})();
				})
		);

		this.electronService.ipcRenderer.on(
			'start_from_tray',
			async (event, arg) =>
				this._ngZone.run(() => {
					this.taskSelect = arg.taskId;
					this.projectSelect = arg.projectId;
					this.note = arg.note;
					this.aw = arg.aw && arg.aw.isAw ? arg.aw.isAw : false;
					this.getUserInfo(arg, true);
				})
		);

		this.electronService.ipcRenderer.on('stop_from_tray', (event, arg) =>
			this._ngZone.run(() => {
				if (arg && arg.quitApp) this.quitApp = true;
				this.toggleStart(false);
			})
		);

		this.electronService.ipcRenderer.on(
			'set_project_task_reply',
			(event, arg) =>
				this._ngZone.run(() => {
					this.setProject(arg.projectId);
					this.setTask(arg.taskId);
					this.note = arg.note;
					this.aw = arg.aw && arg.aw.isAw ? arg.aw.isAw : false;
				})
		);

		this.electronService.ipcRenderer.on('take_screenshot', (event, arg) =>
			this._ngZone.run(() => {
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
							log.info('screenshot_res', source);
							screens.push({
								img: source.thumbnail.toPNG(),
								name: source.name,
								id: source.display_id
							});
							log.info('screenshot data', screens);
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
			})
		);

		this.electronService.ipcRenderer.on('refresh_time_log', (event, arg) =>
			this._ngZone.run(() => {
				this.getTodayTime(arg);
			})
		);

		this.electronService.ipcRenderer.on('show_last_capture', (event, arg) =>
			this._ngZone.run(() => {
				this.getLastTimeSlotImage(arg);
			})
		);

		this.electronService.ipcRenderer.on(
			'last_capture_local',
			(event, arg) =>
				this._ngZone.run(() => {
					console.log('Last Capture Screenshot:');
					this.lastScreenCapture = {
						fullUrl: this.sanitize.bypassSecurityTrustUrl(
							arg.fullUrl
						),
						textTime: moment().fromNow(),
						createdAt: Date.now(),
						recordedAt: Date.now()
					};
				})
		);

		this.electronService.ipcRenderer.on('get_user_detail', (event, arg) =>
			this._ngZone.run(() => {
				this.timeTrackerService.getUserDetail(arg).then((res) => {
					event.sender.send('user_detail', res);
				});
			})
		);

		this.electronService.ipcRenderer.on('save_temp_img', (event, arg) =>
			this._ngZone.run(() => {
				event.sender.send('save_temp_img', arg);
			})
		);

		this.electronService.ipcRenderer.on(
			'update_setting_value',
			(event, arg) =>
				this._ngZone.run(() => {
					this.appSetting = arg;
				})
		);

		this.electronService.ipcRenderer.on('device_sleep', () =>
			this._ngZone.run(() => {
				this.toggleStart(false);
			})
		);

		this.electronService.ipcRenderer.on('device_wakeup', () =>
			this._ngZone.run(() => {
				const elBtn: HTMLElement = this.btnDialogOpen.nativeElement;
				elBtn.click();
			})
		);

		this.electronService.ipcRenderer.on('timer_status', (event, arg) =>
			this._ngZone.run(() => {
				(async () => {
					await this.getTimerStatus(arg);
				})();
			})
		);

		this.electronService.ipcRenderer.on(
			'timer_already_stop',
			(event, arg) =>
				this._ngZone.run(() => {
					this.loading = false;
				})
		);

		this.electronService.ipcRenderer.on(
			'prepare_activities_screenshot',
			(event, arg) =>
				this._ngZone.run(() => {
					this.sendActivities(arg);
				})
		);

		this.electronService.ipcRenderer.on('play_sound', (event, arg) =>
			this._ngZone.run(() => {
				try {
					if (!this.sound && arg.soundFile) {
						this.sound = new Audio(arg.soundFile);
						this.sound.play();
					} else {
						this.sound.play();
					}
				} catch (error) {
					console.log('error play sound', error);
				}
			})
		);

		this.electronService.ipcRenderer.on(
			'show_error_message',
			(event, arg) =>
				this._ngZone.run(() => {
					this.showErrorMessage(arg);
				})
		);
	}

	ngAfterViewInit(): void {
		this.electronService.ipcRenderer.send('time_tracker_ready');
	}

	async toggleStart(val) {
		if (this.loading) {
			return;
		}

		if (!this.checkOnlineStatus()) {
			this.toastrService.show(`Your connection lost`, `Warning`, {
				status: 'danger'
			});
			return;
		}

		if (this.appSetting)
			if (
				this.userData.employee &&
				!this.userData.employee.isTrackingEnabled
			) {
				return;
			}
		this.loading = true;

		if (this.validationField()) {
			if (val) {
				const paramsTimeStart = {
					token: this.token,
					note: this.note,
					projectId: this.projectSelect,
					taskId: this.taskSelect,
					organizationId: this.userOrganization.id,
					tenantId: this.userData.tenantId,
					organizationContactId: this.organizationContactId,
					apiHost: this.apiHost
				};
				this.timeTrackerService
					.toggleApiStart(paramsTimeStart)
					.then(async (res: any) => {
						// We are temporary comment below condition
						// if (res && res.stoppedAt) {
						// 	await this.timeTrackerService.toggleApiStart(paramsTimeStart)
						// }
						this.loading = false;
						this.start = val;
						this.startTime(res);
					})
					.catch((error) => {
						this.loading = false;
						let messageError = error.message;
						if (messageError.includes('Http failure response')) {
							messageError = `Can't connect to api server`;
						} else {
							messageError = 'Internal server error';
						}
						this.toastrService.show(messageError, `Warning`, {
							status: 'danger'
						});
						log.info(
							`Timer Toggle Catch: ${moment().format()}`,
							error
						);
					});
			} else {
				this.loading = false;
				this.start = val;
				console.log('stop tracking');
				this.stopTimer();
			}
		}
	}

	setTime(value) {
		if (!this.start) this.start = true;
		value.second = value.second % 60;
		value.minute = value.minute % 60;
		this.timeRun.next({
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
		});
		if (value.second % 60 === 0) {
			this.electronService.ipcRenderer.send('update_tray_time_update', {
				hours: this.timeRun.getValue().hours,
				minutes: this.timeRun.getValue().minute
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
		this.timeRun.next({
			second: '00',
			minute: '00',
			hours: '00'
		});
	}

	async getTask(arg) {
		this.tasks = await this.timeTrackerService.getTasks(arg);
		const idx = this.tasks.findIndex((row) => row.id === this.taskSelect);
		if (idx > -1) {
			this.tasks[idx].isSelected = true;
		}
		this.tableData = this.tasks;
		this.sourceData.load(this.tableData);
	}

	async getProjects(arg) {
		this.projects = await this.timeTrackerService.getProjects(arg);
	}

	async getClient(arg) {
		this.organizationContacts = await this.timeTrackerService.getClient(
			arg
		);
	}

	/*
	 * Get last running/completed timer status
	 * Get last running/completed timer status
	 * Get last running/completed timer status
	 */
	async getTimerStatus(arg) {
		this.timerStatus = await this.timeTrackerService.getTimerStatus(arg);
		console.log('Get Last Timer Status:', this.timerStatus);
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
		this.argFromMain.organizationContactId = item;
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

		if (this.aw) this.pingAw(null);
		else {
			this.awCheck = false;
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
				this.electronService.ipcRenderer.send('aw_status', true);
			})
			.catch((e) => {
				if (e.status === 200) {
					this.iconAw = 'checkmark-square-outline';
					this.awCheck = true;
					this.statusIcon = 'success';
					this.electronService.ipcRenderer.send('aw_status', true);

					this.loadingAw = false;
				} else {
					this.loadingAw = false;
					this.iconAw = 'close-square-outline';
					this.awCheck = true;
					this.statusIcon = 'danger';
					this.electronService.ipcRenderer.send('aw_status', false);
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
			width: Math.floor(maxDimension * window.devicePixelRatio),
			height: Math.floor(maxDimension * window.devicePixelRatio)
		};
	}

	getTodayTime(arg) {
		this.timeTrackerService.getTimeLogs(arg).then((res: any) => {
			if (res && res.todayDuration) {
				this.countDurationToday(res);
			}
		});
	}

	countDurationToday(countTodayTime) {
		if (countTodayTime) {
			const minutes = Math.floor(countTodayTime.todayDuration / 60);
			const hours = Math.floor(minutes / 60);
			const minuteDuration = minutes % 60;
			this.todayDuration = {
				hours: this.formatingDuration('hours', hours),
				minutes: this.formatingDuration('minutes', minuteDuration)
			};
		}
	}

	formatingDuration(timeEntity, val) {
		switch (timeEntity) {
			case 'hours': {
				return val.toString().length > 1 ? `${val}` : `0${val}`;
			}
			case 'minutes': {
				const minteBackTime = val % 60;
				return minteBackTime.toString().length > 1
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
				let { screenshots } = res;
				console.log('Get Last Timeslot Image Response:', screenshots);
				if (screenshots && screenshots.length > 0) {
					screenshots = _.sortBy(screenshots, 'createdAt').reverse();
					const [lastCaptureScreen] = screenshots;
					console.log('Last Capture Screen:', lastCaptureScreen);
					this.lastScreenCapture = lastCaptureScreen;
					this.localImage(this.lastScreenCapture);
					this.screenshots = screenshots;
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
			})
			.catch((error) => {
				console.log('get last timeslot image error', error);
			});
	}

	async localImage(img) {
		try {
			const convScreenshot = await this.getBase64ImageFromUrl(
				img.fullUrl
			);
			localStorage.setItem(
				'lastScreenCapture',
				JSON.stringify({
					fullUrl: convScreenshot,
					textTime: moment().fromNow(),
					createdAt: Date.now(),
					recordedAt: Date.now()
				})
			);
		} catch (error) {}
	}

	updateImageUrl(e) {
		console.log('image error', e);
		this.lastScreenCapture = {};

		let localLastScreenCapture: any =
			localStorage.getItem('lastScreenCapture');
		if (localLastScreenCapture) {
			localLastScreenCapture = JSON.parse(localLastScreenCapture);
			this.lastScreenCapture.fullUrl =
				this.sanitize.bypassSecurityTrustUrl(
					localLastScreenCapture.fullUrl
				);
		}
	}

	getUserInfo(arg, start) {
		this.timeTrackerService.getUserDetail(arg).then((res: any) => {
			if (res.employee && res.employee.organization) {
				this.userData = res;
				if (res.role && res.role.userPermission) {
					this.userPermission = res.role.userPermission.map(
						(permission) => permission.permission
					);
				}
				this.userOrganization = res.employee.organization;
				this.isTrackingEnabled =
					typeof res.employee.isTrackingEnabled !== 'undefined'
						? res.employee.isTrackingEnabled
						: true;
				if (start) {
					this.toggleStart(true);
				}
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
						case this.dialogType.changeClient.name:
							this.selectClient(option.val);
							break;
						case this.dialogType.deleteLog.name:
							this.deleteTimeSlot();
							break;
						case this.dialogType.timeTrackingOption.name:
							this.toggleStart(true);
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
				console.log('error on delete', e);
				this.toastrService.show(`${e.statusText}`, `Warning`, {
					status: 'danger'
				});
			});
	}

	async removeInvalidTimeLog(arg) {
		try {
			await this.getTimerStatus(arg);
			console.log('this is time status', this.timerStatus);
			if (this.timerStatus.running) {
				await this.timeTrackerService.toggleApiStop(arg);
			}
		} catch (error) {
			console.log('error get last status timer');
		}
	}

	openSetting() {
		this.electronService.ipcRenderer.send('open_setting_window');
	}

	expand() {
		this.isExpand = !this.isExpand;
		if (this.isExpand) {
			this.timerWindow = 'col-4 no-padding full-width timer-max';
			this.expandIcon = 'arrow-left';
		} else {
			this.timerWindow = 'col-12 no-padding full-width';
			this.expandIcon = 'arrow-right';
		}
		this.electronService.ipcRenderer.send('expand', this.isExpand);
	}

	rowSelect(value) {
		this.taskSelect = value.data.id;
		value.data.isSelected = true;
		const selectedLast = value.source.data.findIndex(
			(row) => row.isSelected && row.id !== value.data.id
		);
		if (selectedLast > -1) {
			value.source.data[selectedLast].isSelected = false;
		}
		const idx = value.source.data.findIndex(
			(row) => row.id === value.data.id
		);
		value.source.data.splice(idx, 1, value.data);
		this.setTask(value.data.id);
		value.source.refresh();
	}

	onSearch(query: string = '') {
		if (query) {
			this.sourceData.setFilter(
				[
					{
						field: 'title',
						search: query
					}
				],
				false
			);
		} else {
			this.sourceData.reset();
			this.sourceData.refresh();
		}
	}

	async getScreenshot(arg, isThumb: boolean | null = false) {
		let thumbSize = this.determineScreenshot(arg.screensize);
		if (isThumb)
			thumbSize = {
				width: 320,
				height: 240
			};
		return this.electronService.desktopCapturer
			.getSources({
				types: ['screen'],
				thumbnailSize: thumbSize
			})
			.then((sources) => {
				const screens = [];
				sources.forEach(async (source, i) => {
					log.info('screenshot_res', source);
					if (
						this.appSetting &&
						this.appSetting.monitor &&
						this.appSetting.monitor.captured &&
						this.appSetting.monitor.captured === 'active-only'
					) {
						if (
							source.display_id === arg.activeWindow.id.toString()
						) {
							screens.push({
								img: source.thumbnail.toPNG(),
								name: source.name,
								id: source.display_id
							});
						}
					} else {
						screens.push({
							img: source.thumbnail.toPNG(),
							name: source.name,
							id: source.display_id
						});
					}
				});
				log.info('screenshot data', screens);
				return screens;
			})
			.catch((err) => {
				console.log('screenshot elecctron render error', err);
				return [];
			});
	}

	async getActivities(arg) {
		let windowEvents: any = [];
		let chromeEvent: any = [];
		let firefoxEvent: any = [];
		try {
			// window event
			windowEvents = await this.timeTrackerService.collectevents(
				arg.tpURL,
				arg.tp,
				arg.start,
				arg.end
			);

			//  chrome event
			chromeEvent =
				await this.timeTrackerService.collectChromeActivityFromAW(
					arg.tpURL,
					arg.start,
					arg.end
				);

			// firefox event
			firefoxEvent =
				await this.timeTrackerService.collectFirefoxActivityFromAw(
					arg.tpURL,
					arg.start,
					arg.end
				);
		} catch (error) {
			log.info('failed collect from AW');
		}

		return this.mappingActivities(arg, [
			...windowEvents,
			...chromeEvent,
			...firefoxEvent
		]);
	}

	mappingActivities(arg, activities) {
		return activities.map((act) => {
			return {
				title: act.data.title || act.data.app,
				date: moment(act.timestamp).utc().format('YYYY-MM-DD'),
				time: moment(act.timestamp).utc().format('HH:mm:ss'),
				duration: Math.floor(act.duration),
				type: act.data.title.url ? 'URL' : 'APP',
				taskId: arg.taskId,
				projectId: arg.projectId,
				organizationContactId: arg.organizationContactId,
				organizationId: arg.organizationId,
				employeeId: arg.employeeId,
				source: 'DESKTOP'
			};
		});
	}

	async getAfk(arg) {
		try {
			const afkWatch: any =
				await this.timeTrackerService.collectAfkFromAW(
					arg.tpURL,
					arg.start,
					arg.end
				);
			const afkOnly = afkWatch.filter(
				(afk) => afk.data && afk.data.status === 'afk'
			);
			return this.afkCount(afkOnly);
		} catch (error) {
			return 0;
		}
	}

	async afkCount(afkList) {
		let afkTime = 0;
		afkList.forEach((x) => {
			afkTime += x.duration;
		});
		return afkTime;
	}

	async sendActivities(arg) {
		// screenshot process
		let screenshotImg = [];
		let thumbScreenshotImg = [];
		if (!arg.displays) {
			screenshotImg = await this.getScreenshot(arg, false);
			thumbScreenshotImg = await this.getScreenshot(arg, true);
		} else {
			screenshotImg = arg.displays;
		}

		// notify
		this.screenshotNotify(arg, thumbScreenshotImg);

		// updateActivities to api
		const afktime: number = await this.getAfk(arg);
		const duration = arg.timeUpdatePeriode * 60 - afktime;
		let activities = null;
		if (!arg.activities) {
			activities = await this.getActivities(arg);
		} else {
			activities = arg.activities;
		}

		const ParamActivity = {
			employeeId: arg.employeeId,
			projectId: arg.projectId,
			duration: duration,
			keyboard: Math.floor(arg.durationNonAfk),
			mouse: Math.floor(arg.durationNonAfk),
			overall: Math.floor(arg.durationNonAfk),
			startedAt: arg.startedAt,
			activities: activities,
			timeLogId: arg.timeLogId,
			organizationId: arg.organizationId,
			tenantId: arg.tenantId,
			organizationContactId: arg.organizationContactId,
			apiHost: arg.apiHost,
			token: arg.token,
			isAw: arg.isAw,
			isAwConnected: arg.isAwConnected
		};

		try {
			const resActivities: any =
				await this.timeTrackerService.pushToTimeSlot(ParamActivity);
			console.log('result of timeslot', resActivities);
			const timeLogs = resActivities.timeLogs;
			this.electronService.ipcRenderer.send('return_time_slot', {
				timerId: arg.timerId,
				timeSlotId: resActivities.id,
				quitApp: arg.quitApp,
				timeLogs: timeLogs
			});
			this.electronService.ipcRenderer.send('remove_aw_local_data', {
				idsAw: arg.idsAw
			});
			this.electronService.ipcRenderer.send(
				'remove_wakatime_local_data',
				{
					idsWakatime: arg.idsWakatime
				}
			);

			// upload screenshot to timeslot api
			try {
				await Promise.all(
					screenshotImg.map(async (img) => {
						const imgResult = await this.uploadsScreenshot(
							arg,
							img,
							resActivities.id
						);
						return imgResult;
					})
				);
			} catch (error) {}
		} catch (error) {
			console.log('error send to api timeslot', error);
			this.electronService.ipcRenderer.send('failed_save_time_slot', {
				params: JSON.stringify({
					...ParamActivity,
					b64Imgs: screenshotImg.map((img) => {
						return {
							b64img: this.buffToB64(img),
							fileName: this.fileNameFormat(img)
						};
					})
				}),
				message: error.message
			});
		}
	}

	screenshotNotify(arg, imgs) {
		if (imgs.length > 0) {
			const img: any = imgs[0];
			img.img = this.buffToB64(img);
			this.electronService.ipcRenderer.send(
				'show_screenshot_notif_window',
				img
			);
		}
	}

	async uploadsScreenshot(arg, imgs, timeSlotId) {
		const b64img = this.buffToB64(imgs);
		let fileName = this.fileNameFormat(imgs);
		try {
			const resImg = await this.timeTrackerService.uploadImages(
				{ ...arg, timeSlotId },
				{
					b64Img: b64img,
					fileName: fileName
				}
			);
			this.getLastTimeSlotImage({ ...arg, timeSlotId });
			return resImg;
		} catch (error) {
			this.electronService.ipcRenderer.send('save_temp_img', {
				params: JSON.stringify({
					...arg,
					b64img: b64img,
					fileName: fileName,
					timeSlotId
				}),
				message: error.message,
				type: 'screenshot'
			});
		}
	}

	convertToSlug(text: string) {
		return text
			.toString()
			.toLowerCase()
			.replace(/\s+/g, '-') // Replace spaces with -
			.replace(/\-\-+/g, '-') // Replace multiple - with single -
			.replace(/^-+/, '') // Trim - from start of text
			.replace(/-+$/, ''); // Trim - from end of text
	}

	buffToB64(imgs) {
		const bufferImg: Buffer = Buffer.isBuffer(imgs.img)
			? imgs.img
			: Buffer.from(imgs.img);
		const b64img = bufferImg.toString('base64');
		return b64img;
	}

	fileNameFormat(imgs) {
		let fileName = `screenshot-${moment().format('YYYYMMDDHHmmss')}-${
			imgs.name
		}.png`;
		return this.convertToSlug(fileName);
	}

	async getBase64ImageFromUrl(imageUrl) {
		var res = await fetch(imageUrl);
		var blob = await res.blob();

		return new Promise((resolve, reject) => {
			var reader = new FileReader();
			reader.addEventListener(
				'load',
				function () {
					resolve(reader.result);
				},
				false
			);

			reader.onerror = () => {
				return reject(this);
			};
			reader.readAsDataURL(blob);
		});
	}

	refreshTimer() {
		this.electronService.ipcRenderer.send('refresh-timer');
	}

	checkOnlineStatus() {
		if (navigator.onLine) {
			return true;
		} else {
			return false;
		}
	}

	addTask() {
		this.isAddTask = true;
	}

	cloasAddTask(e) {
		this.isAddTask = false;
		this.electronService.ipcRenderer.send('refresh-timer');
	}

	callbackNewTask(e) {
		if (e.isSuccess) {
			this.toastrService.show(e.message, `Success`, {
				status: 'success'
			});
			this.electronService.ipcRenderer.send('refresh-timer');
		} else {
			this.toastrService.show(e.message, `Warning`, {
				status: 'danger'
			});
		}
	}

	showErrorMessage(msg) {
		this.toastrService.show(`${msg}`, `Warning`, {
			status: 'danger'
		});
	}
}
