import {
	AfterViewInit,
	Component,
	ElementRef,
	forwardRef,
	NgZone,
	OnInit,
	TemplateRef,
	ViewChild
} from '@angular/core';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { TimeTrackerService } from './time-tracker.service';
import * as moment from 'moment';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import * as _ from 'underscore';
import { CustomRenderComponent } from './custom-render-cell.component';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { DomSanitizer } from '@angular/platform-browser';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { ElectronService } from "../electron/services";
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import  'moment-duration-format';

// Import logging for electron and override default console logging
const log = window.require('electron-log');
console.log = log.log;
Object.assign(console, log.functions);

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-desktop-time-tracker',
	templateUrl: './time-tracker.component.html',
	styleUrls: ['./time-tracker.component.scss'],
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => TimeTrackerComponent),
			multi: true
		}
	]
})
export class TimeTrackerComponent implements OnInit, AfterViewInit {
	private _taskTable: Ng2SmartTableComponent;
	@ViewChild('dialogOpenBtn') btnDialogOpen: ElementRef<HTMLElement>;
	@ViewChild('taskTable') set taskTable(content: Ng2SmartTableComponent) {
		if (content) {
			this._taskTable = content;
			this._onChangedSource();
		}
	}
	public start$: BehaviorSubject<boolean> = new BehaviorSubject(false);
	timeRun: BehaviorSubject<any> = new BehaviorSubject({
		second: '00',
		minute: '00',
		hours: '00'
	});
	userData: any;

	private _projects$: BehaviorSubject<any> = new BehaviorSubject([]);
	public get projects$(): Observable<any> {
		return this._projects$.asObservable();
	}

	private _tasks$: BehaviorSubject<any> = new BehaviorSubject([]);
	public get tasks$(): Observable<any> {
		return this._tasks$.asObservable();
	}

	private _organizationContacts$: BehaviorSubject<any> = new BehaviorSubject([]);
	public get organizationContacts$(): Observable<any> {
		return this._organizationContacts$.asObservable();
	}
	organization: any = {};
	projectSelect = '';
	taskSelect = '';
	errors: any = {};
	note: String = '';
	aw$: BehaviorSubject<boolean> = new BehaviorSubject(false);
	loadingAw = false;
	iconAw$: BehaviorSubject<string> = new BehaviorSubject(
		'close-square-outline'
	);
	statusIcon$: BehaviorSubject<string> = new BehaviorSubject('success');
	awCheck = false;
	defaultAwAPI = 'http:localhost:5600';
	public todayDuration$: BehaviorSubject<any> = new BehaviorSubject({
		hours: '00',
		minutes: '00'
	});
	public userOrganization$: BehaviorSubject<any> = new BehaviorSubject({});
	public lastScreenCapture$: BehaviorSubject<any> = new BehaviorSubject({});
	userPermission: any = [];
	quitApp = false;
	organizationContactId = null;
	employeeId = null;
	argFromMain = null;
	token = null;
	apiHost = null;
	screenshots$: BehaviorSubject<any> = new BehaviorSubject([]);
	selectedTimeSlot: any = null;
	lastTimeSlot = null;
	invalidTimeLog = null;
	loading = false;
	appSetting$: BehaviorSubject<any> = new BehaviorSubject(null);
	isExpand$: BehaviorSubject<boolean> = new BehaviorSubject(false);
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
					return moment(due).format(
						this.userData
							? this.userData.employee.organization.dateFormat
							: 'YYYY-MM-DD'
					);
				}
			}
		},
		hideSubHeader: true,
		actions: false,
		noDataMessage: 'No Tasks Found'
	};
	tableData = [];
	private _sourceData$: BehaviorSubject<LocalDataSource>;
	public get sourceData$(): Observable<LocalDataSource> {
		return this._sourceData$.asObservable();
	}
	isTrackingEnabled = true;
	isAddTask = false;
	sound: any = null;
	private _lastTotalWorkedTime = 0;

	constructor(
		private electronService: ElectronService,
		private timeTrackerService: TimeTrackerService,
		private dialogService: NbDialogService,
		private toastrService: NbToastrService,
		private sanitize: DomSanitizer,
		private _ngZone: NgZone
	) {}

	public get start(): boolean {
		return this.start$.getValue();
	}

	public get aw(): boolean {
		return this.aw$.getValue();
	}

	public get iconAw(): string {
		return this.iconAw$.getValue();
	}

	get statusIcon(): string {
		return this.statusIcon$.getValue();
	}

	public get todayDuration(): any {
		return this.todayDuration$.getValue();
	}

	public get userOrganization(): any {
		return this.userOrganization$.getValue();
	}

	public get lastScreenCapture(): any {
		return this.lastScreenCapture$.getValue();
	}

	get screenshots(): any[] {
		return this.screenshots$.getValue();
	}

	get appSetting(): any {
		return this.appSetting$.getValue();
	}

	get isExpand(): boolean {
		return this.isExpand$.getValue();
	}

	ngOnInit(): void {
		this._sourceData$ = new BehaviorSubject(new LocalDataSource(this.tableData));
		this.tasks$
			.pipe(
				tap(async (tasks) => {
					const idx = tasks.findIndex((row) => row.id === this.taskSelect);
					if (idx > -1) {
						tasks[idx].isSelected = true;
					}
					this.tableData = tasks;
					await this._sourceData$.getValue().load(this.tableData);
					
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit(): void {
		this.electronService.ipcRenderer.on('timer_push', (event, arg) =>
			this._ngZone.run(() => {
				this.setTime(arg);
			})
		);

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
					this.aw$.next(arg.aw && arg.aw.isAw ? arg.aw.isAw : false);
					this.appSetting$.next(arg.settings);
					(async () => {
						await this.getClient(arg);
						await this.getProjects(arg);
						await this.getTask(arg);
					})();
					this.getTodayTime(arg);
					this.getUserInfo(arg, false);
					console.log(this.projectSelect);
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
					this.aw$.next(arg.aw && arg.aw.isAw ? arg.aw.isAw : false);
					this.getUserInfo(arg, true);
				})
		);

		this.electronService.ipcRenderer.on('stop_from_tray', (event, arg) =>
			this._ngZone.run(async () => {
				await this.toggleStart(false);
				if (arg && arg.quitApp) this.quitApp = true;
			})
		);

		this.electronService.ipcRenderer.on(
			'set_project_task_reply',
			(event, arg) =>
				this._ngZone.run(async () => {
					await this.setProject(arg.projectId);
					this.setTask(arg.taskId);
					this.note = arg.note;
					this.aw$.next(arg.aw && arg.aw.isAw ? arg.aw.isAw : false);
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
					this.lastScreenCapture$.next({
						fullUrl: this.sanitize.bypassSecurityTrustUrl(
							arg.fullUrl
						),
						textTime: moment().fromNow(),
						createdAt: Date.now(),
						recordedAt: Date.now()
					});
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
					this.appSetting$.next(arg);
				})
		);

		this.electronService.ipcRenderer.on('device_sleep', () =>
			this._ngZone.run(async () => {
				await this.toggleStart(false);
			})
		);

		this.electronService.ipcRenderer.on(
			'stop_from_inactivity_handler',
			async () => {
				await this._ngZone.run(() => {
					if (this.start) this.toggleStart(false);
				});
			}
		);

		this.electronService.ipcRenderer.on(
			'start_from_inactivity_handler',
			async () => {
				await this._ngZone.run(() => {
					this.toggleStart(true);
				});
			}
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

		this.electronService.ipcRenderer.on('logout', (event, arg) =>
			this._ngZone.run(() => {
				if (this.start) this.stopTimer();
			})
		);

		this.electronService.ipcRenderer.on(
			'prepare_activities_screenshot',
			(event, arg) =>
				this._ngZone.run(() => {
					(async () => await this.sendActivities(arg))();
				})
		);

		this.electronService.ipcRenderer.on(
			'backup-no-synced',
			(event, interval) =>
				this._ngZone.run(() => {
					(async () => {
						try {
							const screenshots = interval.screenshots;
							console.log('prepare backup', interval);
							const resActivities: any =
								await this.timeTrackerService.pushToTimeSlot(
									{
										...interval,
										token: this.token,
										apiHost: this.apiHost
									}
								);
							console.log('backup', resActivities);
							// upload screenshot to timeslot api
							const timeSlotId = resActivities.id;
							try {
								await Promise.all(
									screenshots.map(async (screenshot) => {
										try {
											const resImg =
												await this.timeTrackerService.uploadImages(
													{
														...interval,
														token: this.token,
														apiHost: this.apiHost,
														timeSlotId
													},
													{
														b64Img: screenshot.b64img,
														fileName:
															screenshot.fileName
													}
												);
											this.getLastTimeSlotImage({
												...interval,
												token: this.token,
												apiHost: this.apiHost,
												timeSlotId
											});
											console.log('Result upload', resImg);
											return resImg;
										} catch (error) {
											console.log('On upload Image', error)
										}
									})
								);
							} catch (error) {
								console.log('Backup-error', error);
							}
							interval.remoteId = timeSlotId;
							this.electronService.ipcRenderer.send('update-synced', interval)
						} catch (error) {
							console.log('error backup timeslot', error);
						}
					})();
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

		this.electronService.ipcRenderer.on('expand', (event, arg) =>
			this._ngZone.run(() => {
				this.isExpand$.next(arg);
				this.expandIcon = arg ? 'arrow-left' : 'arrow-right';
			})
		);

		this.electronService.ipcRenderer.on('refresh_today_worked_time', (event, arg) =>
			this._ngZone.run(() => {
				this.getTodayTime(arg);
			})
		);

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

		if (!this._passedAllAuthorizations()) return;

		this.loading = true;

		if (this.validationField()) {
			if (val) {
				if (!this.start) {
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
							this.startTime(res);
						})
						.catch((error) => {
							this.loading = false;
							let messageError = error.message;
							if (
								messageError.includes('Http failure response')
							) {
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
					console.log('Error', 'Timer is already running');
				}
			} else {
				console.log('stop tracking');
				this.stopTimer();
			}
		} else {
			this.loading = false;
			console.log('Error', 'validation failed');
		}
	}

	setTime(value) {
		const seconds = moment.duration(value.second, 'seconds').seconds();
		const minutes = moment.duration(value.second, 'seconds').minutes();
		const hours = moment.duration(value.second, 'seconds').hours();
		const instantaneaous = this._lastTotalWorkedTime + value.second;

		this.timeRun.next({
			second: seconds.toString().length > 1 ? `${seconds}` : `0${seconds}`,
			minute: minutes.toString().length > 1 ? `${minutes}` : `0${minutes}`,
			hours: hours.toString().length > 1 ? `${hours}` : `0${hours}`
		});

		this.electronService.ipcRenderer.send('update_tray_time_title', {
			timeRun: moment.duration(instantaneaous, 'seconds').format('hh:mm:ss', { trim: false })
		});

		this.todayDuration$.next({
			hours: this.formatingDuration('hours',  moment.duration(instantaneaous, 'seconds').hours()),
			minutes: this.formatingDuration('minutes',  moment.duration(instantaneaous, 'seconds').minutes())
		});

		if (seconds % 5 === 0) {
			this.pingAw(null);
			if (this.lastScreenCapture.createdAt) {
				this.lastScreenCapture$.next({
					...this.lastScreenCapture,
					textTime: moment(this.lastScreenCapture.createdAt).fromNow()
				});
			}
		}
	}

	startTime(timeLog) {
		this.start$.next(true);
		this.electronService.ipcRenderer.send('update_tray_start');
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
		this.electronService.ipcRenderer.send('request_permission');
		this.loading = false;
	}

	stopTimer() {
		this.electronService.ipcRenderer.send('stop_timer', {
			quitApp: this.quitApp
		});
		this.electronService.ipcRenderer.send('update_tray_stop');
		this.timeRun.next({
			second: '00',
			minute: '00',
			hours: '00'
		});
		this.start$.next(false);
		this.loading = false;
	}

	async getTask(arg) {
		const res = await this.timeTrackerService.getTasks(arg);
		this._tasks$.next(res.items);
	}

	async getProjects(arg) {
		this._projects$.next(await this.timeTrackerService.getProjects(arg));
		console.log('projects', this._projects$.getValue());
	}

	async getClient(arg) {
		this._organizationContacts$.next(await this.timeTrackerService.getClient(
			arg
		));
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
			await this.selectClient(item);
		}
	}

	async selectClient(item) {
		this.organizationContactId = item;
		this.argFromMain.organizationContactId = item;
		this.electronService.ipcRenderer.send('update_project_on', {
			organizationContactId: this.organizationContactId
		});
		if (item) {
			this._projects$.next(await this.timeTrackerService.getProjects({
				...this.argFromMain,
				organizationContactId: this.organizationContactId
			}));
			this._tasks$.next([]);
			this.projectSelect = null;
			this.taskSelect = null;
			this.errors.client = false;
		} else {
			this._projects$.next(await this.timeTrackerService.getProjects(
				this.argFromMain
			))
		}
	}

	async setProject(item) {
		this.projectSelect = item;
		this.electronService.ipcRenderer.send('update_project_on', {
			projectId: this.projectSelect
		});
		if (item) {
			const res = await this.timeTrackerService.getTasks({
				...this.argFromMain,
				projectId: this.projectSelect
			});
			this._tasks$.next(res.items);
			this.taskSelect = null;
			this.errors.project = false;
		} else {
			const res = await this.timeTrackerService.getTasks({
				...this.argFromMain
			});
			this._tasks$.next(res.items);
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
			this.aw$.next(true);
			this.electronService.ipcRenderer.send('set_tp_aw', {
				host: this.defaultAwAPI,
				isAw: true
			});
		} else {
			this.electronService.ipcRenderer.send('set_tp_aw', {
				host: this.defaultAwAPI,
				isAw: false
			});
			this.aw$.next(false);
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
				this.iconAw$.next('checkmark-square-outline');
				this.awCheck = true;
				this.statusIcon$.next('success');
				this.electronService.ipcRenderer.send('aw_status', true);
			})
			.catch((e) => {
				if (e.status === 200) {
					this.iconAw$.next('checkmark-square-outline');
					this.awCheck = true;
					this.statusIcon$.next('success');
					this.electronService.ipcRenderer.send('aw_status', true);

					this.loadingAw = false;
				} else {
					this.loadingAw = false;
					this.iconAw$.next('close-square-outline');
					this.awCheck = true;
					this.statusIcon$.next('danger');
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
			const minutes = moment.duration(countTodayTime.todayDuration, 'seconds').minutes();
			const hours = moment.duration(countTodayTime.todayDuration, 'seconds').hours();
			this.todayDuration$.next({
				hours: this.formatingDuration('hours', hours),
				minutes: this.formatingDuration('minutes', minutes)
			});
			this.electronService.ipcRenderer.send('update_tray_time_update', {
				minutes: this.todayDuration$.getValue().minutes,
				hours: this.todayDuration$.getValue().hours,
			});
			if (!this.start) {
				this._lastTotalWorkedTime = countTodayTime.todayDuration;
				this.electronService.ipcRenderer.send(
					'update_tray_time_title',
					{
						timeRun: moment.duration(this._lastTotalWorkedTime, 'seconds').format('hh:mm:ss', { trim: false })
					}
				);
			}
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
				let {screenshots} = res;
				console.log('Get Last Timeslot Image Response:', screenshots);
				if (screenshots && screenshots.length > 0) {
					screenshots = _.sortBy(screenshots, 'createdAt').reverse();
					const [lastCaptureScreen] = screenshots;
					console.log('Last Capture Screen:', lastCaptureScreen);
					this.lastScreenCapture$.next(lastCaptureScreen);
					this.localImage(this.lastScreenCapture);
					this.screenshots$.next(screenshots);
					this.lastTimeSlot = res;
				} else {
					this.lastScreenCapture$.next({});
				}
				if (this.lastScreenCapture.createdAt) {
					this.lastScreenCapture$.next({
						...this.lastScreenCapture,
						textTime: moment(
							this.lastScreenCapture.createdAt
						).fromNow()
					});
				} else {
					this.lastScreenCapture$.next({});
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
		} catch (error) {
		}
	}

	updateImageUrl(e) {
		console.log('image error', e);
		this.lastScreenCapture$.next({});

		let localLastScreenCapture: any =
			localStorage.getItem('lastScreenCapture');
		if (localLastScreenCapture) {
			localLastScreenCapture = JSON.parse(localLastScreenCapture);
			this.lastScreenCapture$.next({
				...this.lastScreenCapture,
				fullUrl: this.sanitize.bypassSecurityTrustUrl(
					localLastScreenCapture.fullUrl
				)
			});
		}
	}

	getUserInfo(arg, start) {
		this.timeTrackerService.getUserDetail(arg).then(async (res: any) => {
			if (res.employee && res.employee.organization) {
				this.userData = res;
				if (res.role && res.role.userPermission) {
					this.userPermission = res.role.userPermission.map(
						(permission) => permission.permission
					);
				}
				this.userOrganization$.next(res.employee.organization);
				this.electronService.ipcRenderer.send('update_timer_auth_config', {
					activityProofDuration: res.employee.organization.activityProofDuration,
					inactivityTimeLimit: res.employee.organization.inactivityTimeLimit,
					allowTrackInactivity: res.employee.organization.allowTrackInactivity
				});
				this.isTrackingEnabled =
					typeof res.employee.isTrackingEnabled !== 'undefined'
						? res.employee.isTrackingEnabled
						: true;
				if (start) {
					await this.toggleStart(true);
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
			.onClose.subscribe(async (selectedOption) => {
			if (selectedOption) {
				switch (option.type) {
					case this.dialogType.changeClient.name:
						await this.selectClient(option.val);
						break;
					case this.dialogType.deleteLog.name:
						this.deleteTimeSlot();
						break;
					case this.dialogType.timeTrackingOption.name:
						await this.toggleStart(true);
						break;
					default:
						break;
				}
			} else this.stopTimer();
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
		this.electronService.ipcRenderer.send('expand', !this.isExpand);
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
			this._sourceData$.getValue().setFilter(
				[
					{
						field: 'title',
						search: query
					}
				],
				false
			);
		} else {
			this._sourceData$.getValue().reset();
			this._sourceData$.getValue().refresh();
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
			return await this.afkCount(afkOnly);
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

		const paramActivity = {
			employeeId: arg.employeeId,
			projectId: arg.projectId,
			duration: this.aw ? duration : arg.duration,
			keyboard: arg.keyboard,
			mouse: arg.mouse,
			overall: arg.system,
			startedAt: arg.startedAt,
			activities: activities,
			timeLogId: arg.timeLogId,
			organizationId: arg.organizationId,
			tenantId: arg.tenantId,
			organizationContactId: arg.organizationContactId,
			apiHost: arg.apiHost,
			token: arg.token,
			isAw: arg.isAw,
			isAwConnected: arg.isAwConnected,
			version: arg.version
		};

		try {
			const resActivities: any =
				await this.timeTrackerService.pushToTimeSlot(paramActivity);
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
						return await this.uploadsScreenshot(
							arg,
							img,
							resActivities.id
						);
					})
				);
			} catch (error) {
			}
		} catch (error) {
			console.log('error send to api timeslot', error);
			this.electronService.ipcRenderer.send('failed_save_time_slot', {
				params: JSON.stringify({
					...paramActivity,
					b64Imgs: screenshotImg.map((img) => {
						return {
							b64img: this.buffToB64(img),
							fileName: this.fileNameFormat(img)
						};
					})
				}),
				message: error.message
			});

			this.electronService.ipcRenderer.send('failed_synced_timeslot', {
				params: {
					...paramActivity,
					b64Imgs: screenshotImg.map((img) => {
						return {
							b64img: this.buffToB64(img),
							fileName: this.fileNameFormat(img)
						};
					})
				}
			} )
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
				{...arg, timeSlotId},
				{
					b64Img: b64img,
					fileName: fileName
				}
			);
			this.getLastTimeSlotImage({...arg, timeSlotId});
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

	/**
	 * Check if user have required authorization to use time tracker
	 */
	private _passedAllAuthorizations(): boolean {
		let isPassed: boolean = false;
		// Verify if tracking is enabled
		if (
			!this.userData.employee.isTrackingEnabled
		) {
			this.toastrService.show('Your can\'t run timer for the moment', `Warning`, {
				status: 'danger'
			});
			isPassed = false;
		}
		// Verify work status of user
		else if (
			!this.userData.employee.startedWorkOn
			|| !this.userData.employee.isActive
			|| this.userData.employee.workStatus
		) {
			// Verify if user are already started to work for organization, if yes you can run time tracker else no
			if (!this.userData.employee.startedWorkOn) {
				this.toastrService.show('Your are not authorized to work', `Warning`, {
					status: 'danger'
				});
			}
			// Verify if user are deleted for organization, if yes can't run time tracker
			if (this.userData.employee.startedWorkOn && !this.userData.employee.isActive) {
				this.toastrService.show('Your account it already deleted', `Warning`, {
					status: 'danger'
				});
			}
			isPassed = false;
		} else isPassed = true;
		return isPassed;
	}

	private _onChangedSource() {
		this._taskTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this._clearItem()),
				tap(() => {
					if (this.taskSelect) {
						this._taskTable.grid.dataSet.getRows().map((row) => {
							console.log(row.getData());
							if (row.getData().id === this.taskSelect) {
								return this._taskTable.grid.dataSet.selectRow(
									row
								);
							}
						});
					}
				})
			)
			.subscribe();
	}

	private _clearItem() {
		if (this._taskTable && this._taskTable.grid) {
			this._taskTable.grid.dataSet['willSelect'] = 'false';
			this._taskTable.grid.dataSet.deselectAll();
		}
	}
}
