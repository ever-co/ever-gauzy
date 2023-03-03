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
import { NbDialogService, NbIconLibraries, NbToastrService } from '@nebular/theme';
import { TimeTrackerService } from './time-tracker.service';
import * as moment from 'moment';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import * as _ from 'underscore';
import { CustomRenderComponent } from './custom-render-cell.component';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { DomSanitizer } from '@angular/platform-browser';
import { BehaviorSubject, Observable, Subject, tap } from 'rxjs';
import { ElectronService } from '../electron/services';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import 'moment-duration-format';
import {
	ContactType,
	IOrganization,
	IOrganizationContact,
	ITask,
	PermissionsEnum,
	ProjectOwnerEnum,
	TaskStatusEnum
} from '@gauzy/contracts';
import { Store } from '@gauzy/desktop-timer/src/app/auth/services/store.service';

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
			multi: true,
		},
	],
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
	private _timeRun$: BehaviorSubject<string> = new BehaviorSubject(
		'00:00:00'
	);
	private get _timeRun(): string {
		return this._timeRun$.getValue();
	}
	public get timeRun$(): Observable<string> {
		return this._timeRun$.asObservable();
	}
	userData: any;

	private _projects$: BehaviorSubject<any> = new BehaviorSubject([]);
	public get projects$(): Observable<any> {
		return this._projects$.asObservable();
	}

	private _tasks$: BehaviorSubject<any> = new BehaviorSubject([]);
	public get tasks$(): Observable<any> {
		return this._tasks$.asObservable();
	}

	private _organizationContacts$: BehaviorSubject<any> = new BehaviorSubject(
		[]
	);
	public get organizationContacts$(): Observable<any> {
		return this._organizationContacts$.asObservable();
	}
	organization: any = {};
	projectSelect = '';
	taskSelect = '';
	errors: any = {};
	note: String = '';
	private _aw$: BehaviorSubject<boolean> = new BehaviorSubject(false);
	public get aw$(): Observable<boolean> {
		return this._aw$.asObservable();
	}
	iconAw$: BehaviorSubject<string> = new BehaviorSubject(
		'close-square-outline'
	);
	statusIcon$: BehaviorSubject<string> = new BehaviorSubject('success');
	defaultAwAPI = 'http:localhost:5600';
	public todayDuration$: BehaviorSubject<any> = new BehaviorSubject(
		'--h --m'
	);
	public weeklyDuration$: BehaviorSubject<any> = new BehaviorSubject(
		'--h --m'
	);
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
				'Do you really want to remove this screenshot and activities log ?',
		},
		changeClient: {
			name: 'changeClient',
			message: 'Are you sure you want to change Client ?',
		},
		timeTrackingOption: {
			name: 'timeTrackingOption',
			message: 'Your timer was running when PC was locked. Resume timer?',
		},
	};
	timerStatus: any;
	expandIcon = 'arrow-right';
	tableHeader = {
		columns: {
			title: {
				title: 'Task',
				type: 'custom',
				renderComponent: CustomRenderComponent,
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
				},
			},
		},
		hideSubHeader: true,
		actions: false,
		noDataMessage: 'No Tasks Found',
		pager: {
			display: true,
			perPage: 10,
			page: 1,
		},
	};
	tableData = [];
	private _sourceData$: BehaviorSubject<LocalDataSource>;
	private get _sourceData(): LocalDataSource {
		return this._sourceData$.getValue();
	}
	public get sourceData$(): Observable<LocalDataSource> {
		return this._sourceData$.asObservable();
	}
	isTrackingEnabled = true;
	isAddTask = false;
	sound: any = null;
	private _lastTotalWorkedToday = 0;
	private _lastTotalWorkedWeek = 0;
	private _isOffline$: BehaviorSubject<boolean> = new BehaviorSubject(false);
	private _inQueue$: BehaviorSubject<number> = new BehaviorSubject(0);
	private _isRefresh$: BehaviorSubject<boolean> = new BehaviorSubject(false);
	private _permissions$: Subject<any> = new Subject();

	public hasTaskPermission$: BehaviorSubject<boolean> = new BehaviorSubject(
		false
	);
	private get _hasTaskPermission(): boolean {
		return this.hasTaskPermission$.getValue();
	}
	public hasProjectPermission$: BehaviorSubject<boolean> =
		new BehaviorSubject(false);
	public hasContactPermission$: BehaviorSubject<boolean> =
		new BehaviorSubject(false);
	private _activityWatchLog$: BehaviorSubject<string> = new BehaviorSubject(
		null
	);
	public get activityWatchLog$(): Observable<string> {
		return this._activityWatchLog$.asObservable();
	}
	private get _isOffline(): boolean {
		return this._isOffline$.getValue();
	}

	constructor(
		private electronService: ElectronService,
		private timeTrackerService: TimeTrackerService,
		private dialogService: NbDialogService,
		private toastrService: NbToastrService,
		private sanitize: DomSanitizer,
		private _ngZone: NgZone,
		private iconLibraries: NbIconLibraries,
		private _store: Store
	) {
		this.iconLibraries.registerFontPack('font-awesome', {
			packClass: 'fas',
			iconClassPrefix: 'fa',
		});
		this._permissions$
			.pipe(
				tap((permissions: any[]) => {
					this.hasTaskPermission$.next(
						permissions.includes(PermissionsEnum.ORG_TASK_ADD)
					);
					this.hasProjectPermission$.next(
						permissions.includes(PermissionsEnum.ORG_PROJECT_ADD)
					);
					this.hasContactPermission$.next(
						permissions.includes(PermissionsEnum.ORG_CONTACT_EDIT)
					);
				})
			)
			.subscribe();
		this.aw$
			.pipe(
				tap((isChecked: boolean) => {
					this.pingAw(null);
					this.electronService.ipcRenderer.send('set_tp_aw', {
						host: this.defaultAwAPI,
						isAw: isChecked,
					});
				})
			)
			.subscribe();
		this.isOffline$
			.pipe(
				tap((value) => {
					this._store.isOffline = value;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public get start(): boolean {
		return this.start$.getValue();
	}

	public get aw(): boolean {
		return this._aw$.getValue();
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
		this._sourceData$ = new BehaviorSubject(
			new LocalDataSource(this.tableData)
		);
		this.tasks$
			.pipe(
				tap(async (tasks) => {
					if (tasks.length > 0) {
						const idx = tasks.findIndex(
							(row) => row.id === this.taskSelect
						);
						if (idx > -1) {
							tasks[idx].isSelected = true;
						}
					}
					this.tableData = tasks;
					await this._sourceData.load(this.tableData);
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
					this._isOffline$.next(
						arg.isOffline
							? arg.isOffline
							: this._isOffline
					);
					this.apiHost = arg.apiHost;
					this.argFromMain = arg;
					this.taskSelect = arg.taskId;
					this.projectSelect = arg.projectId;
					this.organizationContactId = arg.organizationContactId;
					this.token = arg.token;
					this.note = arg.note;
					this._aw$.next(arg.aw && arg.aw.isAw ? arg.aw.isAw : false);
					this.appSetting$.next(arg.settings);
					(async () => {
						await this.getClient(arg);
						await this.getProjects(arg);
						await this.getTask(arg);
					})();
					this.getTodayTime(arg);
					this.getUserInfo(arg, false);
					(async () => {
						if (arg.timeSlotId) {
							this.getLastTimeSlotImage(arg);
						}
					})();
					this._isRefresh$.next(false);
				})
		);

		this.electronService.ipcRenderer.on(
			'start_from_tray',
			async (event, arg) =>
				this._ngZone.run(() => {
					this.taskSelect = arg.taskId;
					this.projectSelect = arg.projectId;
					this.note = arg.note;
					this._aw$.next(arg.aw && arg.aw.isAw ? arg.aw.isAw : false);
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
					this._aw$.next(arg.aw && arg.aw.isAw ? arg.aw.isAw : false);
				})
		);

		this.electronService.ipcRenderer.on('take_screenshot', (event, arg) =>
			this._ngZone.run(() => {
				log.info(`Take Screenshot:`, arg);

				const thumbSize = this.determineScreenshot(arg.screenSize);
				this.electronService.desktopCapturer
					.getSources({
						types: ['screen'],
						thumbnailSize: thumbSize,
					})
					.then((sources) => {
						const screens = [];
						sources.forEach(async (source, i) => {
							log.info('screenshot_res', source);
							screens.push({
								img: source.thumbnail.toPNG(),
								name: source.name,
								id: source.display_id,
							});
							log.info('screenshot data', screens);
						});
						if (!arg.isTemp) {
							event.sender.send('save_screen_shoot', {
								screens: screens,
								timeSlotId: arg.timeSlotId,
								quitApp: this.quitApp,
							});
						} else {
							event.sender.send('save_temp_screenshot', {
								screens: screens,
								timeSlotId: arg.timeSlotId,
								quitApp: this.quitApp,
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
						thumbUrl: this.sanitize.bypassSecurityTrustUrl(
							arg.fullUrl
						),
						textTime: moment().fromNow(),
						createdAt: Date.now(),
						recordedAt: Date.now(),
					});
					this.screenshots$.next([...this.screenshots]);
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

		this.electronService.ipcRenderer.on('device_wake_up', () =>
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
			this._ngZone.run(async () => {
				if (this.isExpand) this.expand();
				if (this.start) await this.stopTimer();
				if (arg) event.sender.send('restart_and_update');
			})
		);

		this.electronService.ipcRenderer.on(
			'prepare_activities_screenshot',
			(event, arg) =>
				this._ngZone.run(async () => {
					await this.sendActivities(arg);
				})
		);

		this.electronService.ipcRenderer.on('backup-no-synced', (event, args) =>
			this._ngZone.run(async () => {
				console.log('--------> SYNC LOADING... <------', args);
				const intervals = args[0];
				const lastTimer = args[1];
				for (const interval of intervals) {
					try {
						interval.activities = JSON.parse(
							interval.activities as any
						);
						interval.screenshots = JSON.parse(
							interval.screenshots as any
						);
						const screenshots = interval.screenshots;
						console.log('prepare backup', interval);
						const resActivities: any =
							await this.timeTrackerService.pushToTimeSlot({
								...interval,
								recordedAt: interval.startedAt,
								token: this.token,
								apiHost: this.apiHost,
							});
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
													recordedAt:
														interval.startedAt,
													token: this.token,
													apiHost: this.apiHost,
													timeSlotId,
												},
												{
													b64Img: screenshot.b64img,
													fileName:
														screenshot.fileName,
												}
											);
										this.getLastTimeSlotImage({
											...interval,
											token: this.token,
											apiHost: this.apiHost,
											timeSlotId,
										});
										console.log('Result upload', resImg);
										return resImg;
									} catch (error) {
										console.log('On upload Image', error);
									}
								})
							);
						} catch (error) {
							console.log('Backup-error', error);
						}
						interval.remoteId = timeSlotId;
						this.electronService.ipcRenderer.send(
							'update-synced',
							interval
						);
					} catch (error) {
						console.log('error backup timeslot', error);
					}
				}
				console.log('TIMER TO UPDATE', lastTimer);
				await this.getTimerStatus({
					token: this.token,
					apiHost: this.apiHost,
					organizationId: this.userOrganization.id,
					tenantId: this.userData.tenantId,
				});
				setTimeout(() => {
					event.sender.send('update-synced-timer', {
						lastTimer: {
							...lastTimer,
							id: this.timerStatus.lastLog.id,
						},
						...lastTimer,
					});
					event.sender.send('finish-synced-timer');
				}, 0);
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

		this.electronService.ipcRenderer.on(
			'refresh_today_worked_time',
			(event, arg) =>
				this._ngZone.run(() => {
					this.getTodayTime(arg);
				})
		);

		this.electronService.ipcRenderer.on(
			'offline-handler',
			(event, isOffline) => {
				this._ngZone.run(() => {
					this._isOffline$.next(isOffline);
					this.toastrService.show(
						'You switched to ' +
							(isOffline ? 'offline' : 'online') +
							' mode now',
						`Warning`,
						{
							status: isOffline ? 'danger' : 'success',
						}
					);
					if (!isOffline) {
						this.refreshTimer();
					}
				});
			}
		);

		this.electronService.ipcRenderer.on('count-synced', (event, arg) => {
			this._ngZone.run(() => {
				console.log(arg);
				this._inQueue$.next(arg);
			});
		});

		this.electronService.ipcRenderer.on(
			'latest_screenshots',
			(event, args) => {
				this._ngZone.run(() => {
					if (this._isOffline) {
						this._mappingScreenshots(args);
					}
				});
			}
		);

		this.electronService.ipcRenderer.on(
			'backup-timers-no-synced',
			(
				event,
				args: {
					timer: any;
					intervals: any[];
				}[]
			) => {
				this._ngZone.run(async () => {
					for (const sequence of args) {
						let latest = null;
						const params = {
							token: this.token,
							note: this.note,
							organizationId: this.userOrganization.id,
							tenantId: this.userData.tenantId,
							organizationContactId: this.organizationContactId,
							apiHost: this.apiHost,
							taskId: this.taskSelect,
							projectId: this.projectSelect,
						};
						if (sequence.timer.isStartedOffline) {
							console.log('--------> START SYNC <------');
							latest =
								await this.timeTrackerService.toggleApiStart({
									...sequence.timer,
									...params,
								});
						}
						console.log(
							'--------> SYNC LOADING... <------',
							latest
						);
						for (const interval of sequence.intervals) {
							try {
								interval.activities = JSON.parse(
									interval.activities as any
								);
								interval.screenshots = JSON.parse(
									interval.screenshots as any
								);
								const screenshots = interval.screenshots;
								console.log('prepare backup', interval);
								const resActivities: any =
									await this.timeTrackerService.pushToTimeSlot(
										{
											...interval,
											recordedAt: interval.startedAt,
											token: this.token,
											apiHost: this.apiHost,
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
															recordedAt:
																interval.startedAt,
															token: this.token,
															apiHost:
																this.apiHost,
															timeSlotId,
														},
														{
															b64Img: screenshot.b64img,
															fileName:
																screenshot.fileName,
														}
													);
												this.getLastTimeSlotImage({
													...interval,
													token: this.token,
													apiHost: this.apiHost,
													timeSlotId,
												});
												console.log(
													'Result upload',
													resImg
												);
												return resImg;
											} catch (error) {
												console.log(
													'On upload Image',
													error
												);
											}
										})
									);
								} catch (error) {
									console.log('Backup-error', error);
								}
								interval.remoteId = timeSlotId;
								this.electronService.ipcRenderer.send(
									'update-synced',
									interval
								);
							} catch (error) {
								console.log('error backup timeslot', error);
							}
						}
						if (sequence.timer.isStoppedOffline) {
							console.log('--------> STOP SYNC <------');
							latest =
								await this.timeTrackerService.toggleApiStop({
									...sequence.timer,
									...params,
								});
						}
						await this.getTimerStatus({
							token: this.token,
							apiHost: this.apiHost,
							organizationId: this.userOrganization.id,
							tenantId: this.userData.tenantId,
						});
						setTimeout(() => {
							event.sender.send('update-synced-timer', {
								lastTimer: latest
									? latest
									: {
											...sequence.timer,
											id: this.timerStatus.lastLog.id,
									  },
								...sequence.timer,
							});
						}, 0);
					}
					setTimeout(() => {
						event.sender.send('finish-synced-timer');
					}, 0);
				});
			}
		);
		this.electronService.ipcRenderer.send('time_tracker_ready');
		this.electronService.ipcRenderer.on(
			'toggle_timer_state',
			(event, arg) => {
				this._ngZone.run(async () => {
					try {
						const { lastTimer, isStarted } = arg;
						const params = {
							token: this.token,
							note: this.note,
							projectId: this.projectSelect,
							taskId: this.taskSelect,
							organizationId: this.userOrganization.id,
							tenantId: this.userData.tenantId,
							organizationContactId: this.organizationContactId,
							apiHost: this.apiHost,
						};
						let timelog = null;
						console.log('[TIMER_STATE]', lastTimer);
						if (isStarted) {
							if (!this._isOffline) {
								timelog =
									await this.timeTrackerService.toggleApiStart(
										{
											...lastTimer,
											...params,
										}
									);
							}
							this.loading = false;
						} else {
							if (!this._isOffline) {
								timelog =
									await this.timeTrackerService.toggleApiStop(
										{
											...lastTimer,
											...params,
										}
									);
							}
							this.start$.next(false);
							this.loading = false;
							this._timeRun$.next('00:00:00');
						}
						setTimeout(() => {
							if (!this._isOffline) {
								event.sender.send('update-synced-timer', {
									lastTimer: timelog,
									...lastTimer,
								});
							}
						}, 0);
					} catch (error) {
						this.loading = false;
						let messageError = error.message;
						if (messageError.includes('Http failure response')) {
							messageError = `Can't connect to api server`;
						} else {
							messageError = 'Internal server error';
						}
						this.toastrService.show(messageError, `Warning`, {
							status: 'danger',
						});
						log.info(
							`Timer Toggle Catch: ${moment().format()}`,
							error
						);
					}
				});
			}
		);
		this.electronService.ipcRenderer.on(
			'remove_idle_time',
			(event, arg) => {
				this._ngZone.run(async () => {
					try {
						const { tenantId, employeeId } = this.userData;
						const { id: organizationId } = this.userOrganization;
						const payload = {
							timeslotIds: [..._.uniq(arg.timeslotIds)],
							token: this.token,
							apiHost: this.apiHost,
							tenantId,
							organizationId,
						};
						const notification = {
							message: 'Idle time successfully deleted',
							title: 'Gauzy',
						};
						const isReadyForDeletion =
							!this._isOffline && payload.timeslotIds.length > 0;
						if (isReadyForDeletion) {
							// Silent delete and restart
							if (arg.isWorking && this.start) {
								const params = {
									token: this.token,
									note: this.note,
									projectId: this.projectSelect,
									taskId: this.taskSelect,
									organizationId: this.userOrganization.id,
									tenantId: this.userData.tenantId,
									organizationContactId:
										this.organizationContactId,
									apiHost: this.apiHost,
								};
								this.timeTrackerService
									.toggleApiStop({
										...params,
										...arg.timer,
										stoppedAt: new Date(),
									})
									.then(() =>
										this.timeTrackerService
											.deleteTimeSlots(payload)
											.then(async () => {
												console.log('Deleted');
												const timelog =
													await this.timeTrackerService.toggleApiStart(
														{
															...params,
															startedAt:
																new Date(),
														}
													);
												this.getTodayTime(
													{ ...payload, employeeId },
													true
												);
												setTimeout(() => {
													event.sender.send(
														'update_session',
														{ ...timelog }
													);
													event.sender.send(
														'update-synced-timer',
														{
															lastTimer: timelog,
															...arg.timer,
														}
													);
												}, 0);
											})
									);
							} else {
								do {
									await this.getTimerStatus(payload);
									console.log('Waiting...');
								} while (this.timerStatus.running);
								await this.timeTrackerService.deleteTimeSlots(
									payload
								);
							}
						}
						if (this._isOffline || isReadyForDeletion) {
							this.toastrService.success(
								notification.message,
								notification.title
							);
							event.sender.send('notify', notification);
						}
					} catch (error) {
						this.toastrService.danger('An Error Occurred', 'Gauzy');
						console.log('ERROR', error);
					}
				});
			}
		);
	}

	async toggleStart(val) {
		if (this.loading) {
			return;
		}

		if (!this._passedAllAuthorizations()) return;

		this.loading = true;

		if (this.validationField()) {
			if (val) {
				if (!this.start) {
					this.startTime();
				} else {
					this.loading = false;
					console.log('Error', 'Timer is already running');
				}
			} else {
				console.log('stop tracking');
				await this.stopTimer();
			}
		} else {
			this.loading = false;
			console.log('Error', 'validation failed');
		}
	}

	setTime(value) {
		const instantaneaous = this._lastTotalWorkedToday + value.second;
		const instantaneousWeek = this._lastTotalWorkedWeek + value.second;
		this.todayDuration$.next(
			moment
				.duration(instantaneaous, 'seconds')
				.format('hh[h] mm[m]', { trim: false, trunc: true })
		);
		this.weeklyDuration$.next(
			moment
				.duration(instantaneousWeek, 'seconds')
				.format('hh[h] mm[m]', { trim: false, trunc: true })
		);
		this._timeRun$.next(
			moment
				.duration(value.second, 'seconds')
				.format('hh:mm:ss', { trim: false })
		);
		this.electronService.ipcRenderer.send(
			'update_tray_time_update',
			this.todayDuration
		);
		this.electronService.ipcRenderer.send('update_tray_time_title', {
			timeRun: moment
				.duration(instantaneaous, 'seconds')
				.format('hh:mm:ss', { trim: false }),
		});

		if (value.second % 5 === 0) {
			this.pingAw(null);
			if (this.lastScreenCapture.createdAt) {
				this.lastScreenCapture$.next({
					...this.lastScreenCapture,
					textTime: moment(
						this.lastScreenCapture.createdAt
					).fromNow(),
				});
			}
		}
	}

	startTime() {
		this.start$.next(true);
		this.electronService.ipcRenderer.send('update_tray_start');
		this.electronService.ipcRenderer.send('start_timer', {
			projectId: this.projectSelect,
			taskId: this.taskSelect,
			note: this.note,
			organizationContactId: this.organizationContactId,
			aw: {
				host: this.defaultAwAPI,
				isAw: this.aw,
			},
			timeLog: null,
		});
		this.electronService.ipcRenderer.send('request_permission');
	}

	async stopTimer() {
		try {
			this.electronService.ipcRenderer.send('stop_timer', {
				quitApp: this.quitApp,
			});
			this.electronService.ipcRenderer.send('update_tray_stop');
		} catch (error) {
			console.log('[ERROR_STOP_TIMER]', error);
		}
	}

	async getTask(arg) {
		const res = await this.timeTrackerService.getTasks(arg);
		this._tasks$.next(res || []);
	}

	async getProjects(arg) {
		this._projects$.next(await this.timeTrackerService.getProjects(arg));
	}

	async getClient(arg) {
		this._organizationContacts$.next(
			await this.timeTrackerService.getClient(arg)
		);
	}

	/*
	 * Get last running/completed timer status
	 * Get last running/completed timer status
	 * Get last running/completed timer status
	 */
	async getTimerStatus(arg) {
		if (this._isOffline) return;
		this.timerStatus = await this.timeTrackerService.getTimerStatus(arg);
		console.log('Get Last Timer Status:', this.timerStatus);
	}

	async setClient(item, dialog) {
		if (this.start) {
			this.open(dialog, {
				type: this.dialogType.changeClient.name,
				val: item,
			});
		} else {
			await this.selectClient(item);
		}
	}

	async selectClient(item) {
		this.organizationContactId = item;
		this.argFromMain.organizationContactId = item;
		this.electronService.ipcRenderer.send('update_project_on', {
			organizationContactId: this.organizationContactId,
		});
		if (item) {
			this._projects$.next(
				await this.timeTrackerService.getProjects({
					...this.argFromMain,
					organizationContactId: this.organizationContactId,
				})
			);
			this._tasks$.next([]);
			this.projectSelect = null;
			this.taskSelect = null;
			this.errors.client = false;
		} else {
			this._projects$.next(
				await this.timeTrackerService.getProjects(this.argFromMain)
			);
		}
	}

	async setProject(item) {
		this.projectSelect = item;
		this.electronService.ipcRenderer.send('update_project_on', {
			projectId: this.projectSelect,
		});
		if (item) {
			const res = await this.timeTrackerService.getTasks({
				...this.argFromMain,
				projectId: this.projectSelect,
			});
			this._tasks$.next(res || []);
			this.taskSelect = null;
			this.errors.project = false;
		} else {
			const res = await this.timeTrackerService.getTasks({
				...this.argFromMain,
			});
			this._tasks$.next(res || []);
		}
		this.errorBind();
	}

	setTask(item) {
		this.taskSelect = item;
		this.electronService.ipcRenderer.send('update_project_on', {
			taskId: this.taskSelect,
		});
		if (item) this.errors.task = false;
	}

	descriptionChange(e) {
		if (e) this.errors.note = false;
		this.setTask(null);
		this._clearItem();
		this.electronService.ipcRenderer.send('update_project_on', {
			note: this.note,
		});
	}

	setAW(checked: boolean) {
		this._aw$.next(checked);
	}

	pingAw(host) {
		this.timeTrackerService
			.pingAw(`${host || this.defaultAwAPI}/api`)
			.then((res) => {
				this.iconAw$.next('checkmark-square-outline');
				this.statusIcon$.next('success');
				this.electronService.ipcRenderer.send('aw_status', true);
				this._activityWatchLog$.next("Activity Watch's connected");
			})
			.catch((e) => {
				if (e.status === 200) {
					this.iconAw$.next('checkmark-square-outline');
					this.statusIcon$.next('success');
					this.electronService.ipcRenderer.send('aw_status', true);
					this._activityWatchLog$.next("Activity Watch's connected");
				} else {
					this.iconAw$.next('close-square-outline');
					this.statusIcon$.next('danger');
					this.electronService.ipcRenderer.send('aw_status', false);
					this._activityWatchLog$.next(
						"Activity Watch's Disconnected"
					);
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
			note: 'requireDescription',
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

	doShoot() {
		this.electronService.ipcRenderer.send('screen_shoot');
	}

	determineScreenshot(screenSize) {
		const maxDimension = Math.max(screenSize.width, screenSize.height);
		console.log(maxDimension);

		return {
			width: Math.floor(maxDimension * window.devicePixelRatio),
			height: Math.floor(maxDimension * window.devicePixelRatio),
		};
	}

	getTodayTime(arg, isForcedSync?) {
		if (this._isOffline) return;
		this.timeTrackerService.getTimeLogs(arg).then((res: any) => {
			if (res && res.todayDuration && res.weekDuration) {
				this.countDuration(res, isForcedSync);
			}
		});
	}

	countDuration(count, isForcedSync?) {
		if (count && (!this.start || isForcedSync)) {
			this._lastTotalWorkedToday = count.todayDuration;
			this._lastTotalWorkedWeek = count.weekDuration;
			this.todayDuration$.next(
				moment
					.duration(this._lastTotalWorkedToday, 'seconds')
					.format('hh[h] mm[m]', { trim: false, trunc: true })
			);
			this.weeklyDuration$.next(
				moment
					.duration(this._lastTotalWorkedWeek, 'seconds')
					.format('hh[h] mm[m]', { trim: false, trunc: true })
			);
			this.electronService.ipcRenderer.send(
				'update_tray_time_update',
				this.todayDuration
			);
			this.electronService.ipcRenderer.send('update_tray_time_title', {
				timeRun: moment
					.duration(this._lastTotalWorkedToday, 'seconds')
					.format('hh:mm:ss', { trim: false }),
			});
		}
	}

	getLastTimeSlotImage(arg) {
		if (this._isOffline) return;
		this.timeTrackerService
			.getTimeSlot(arg)
			.then((res: any) => {
				let { screenshots } = res;
				console.log('Get Last Timeslot Image Response:', screenshots);
				if (screenshots && screenshots.length > 0) {
					screenshots = _.sortBy(screenshots, 'recordedAt').reverse();
					const [lastCaptureScreen] = screenshots;
					console.log('Last Capture Screen:', lastCaptureScreen);
					this.lastScreenCapture$.next(lastCaptureScreen);
					this.localImage(this.lastScreenCapture);
					this.screenshots$.next(screenshots);
					this.lastTimeSlot = res;
				} else {
					this.lastScreenCapture$.next({});
				}
				if (this.lastScreenCapture.recordedAt) {
					this.lastScreenCapture$.next({
						...this.lastScreenCapture,
						textTime: moment(
							this.lastScreenCapture.recordedAt
						).fromNow(),
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
			const convScreenshot =
				img && img.fullUrl
					? await this.getBase64ImageFromUrl(img.fullUrl)
					: img;
			localStorage.setItem(
				'lastScreenCapture',
				JSON.stringify({
					fullUrl: convScreenshot,
					textTime: moment().fromNow(),
					createdAt: Date.now(),
					recordedAt: Date.now(),
				})
			);
		} catch (error) {}
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
				),
			});
		}
	}

	getUserInfo(arg, start) {
		this.timeTrackerService.getUserDetail(arg).then(async (res: any) => {
			if (res.employee && res.employee.organization) {
				this.userData = res;
				if (res.role && res.role.rolePermissions) {
					this.userPermission = res.role.rolePermissions
						.map((permission) =>
							permission.enabled ? permission.permission : null
						)
						.filter((permission) => !!permission);
					this._permissions$.next(this.userPermission);
				}
				this.userOrganization$.next(res.employee.organization);
				this.electronService.ipcRenderer.send(
					'update_timer_auth_config',
					{
						activityProofDuration:
							res.employee.organization.activityProofDuration,
						inactivityTimeLimit:
							res.employee.organization.inactivityTimeLimit,
						allowTrackInactivity:
							res.employee.organization.allowTrackInactivity,
						isRemoveIdleTime:
							res.employee.organization.isRemoveIdleTime,
						allowScreenshotCapture:
							res.employee.organization.allowScreenshotCapture &&
							res.employee.allowScreenshotCapture,
					}
				);
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
				context: this.dialogType[option.type].message,
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
				} else if (this.start) await this.stopTimer();
			});
	}

	deleteTimeSlot() {
		this.timeTrackerService
			.deleteTimeSlot({
				...this.argFromMain,
				timeSlotId: this.selectedTimeSlot.id,
			})
			.then((res) => {
				this.getLastTimeSlotImage(this.argFromMain);
				this.toastrService.show(
					`Successfully remove last screenshot and activities`,
					`Success`,
					{
						status: 'success',
					}
				);
			})
			.catch((e) => {
				console.log('error on delete', e);
				this.toastrService.show(`${e.statusText}`, `Warning`, {
					status: 'danger',
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
			this._sourceData.setFilter(
				[
					{
						field: 'title',
						search: query,
					},
					{
						field: 'taskNumber',
						search: query,
					},
				],
				false
			);
		} else {
			this._sourceData.reset();
			this._sourceData.refresh();
		}
	}

	async getScreenshot(arg, isThumb: boolean | null = false) {
		let thumbSize = this.determineScreenshot(arg.screenSize);
		if (isThumb)
			thumbSize = {
				width: 320,
				height: 240,
			};
		return this.electronService.desktopCapturer
			.getSources({
				types: ['screen'],
				thumbnailSize: thumbSize,
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
							arg.activeWindow &&
							source.display_id === arg.activeWindow.id.toString()
						) {
							screens.push({
								img: source.thumbnail.toPNG(),
								name: source.name,
								id: source.display_id,
							});
						}
					} else {
						if (arg.activeWindow) {
							screens.push({
								img: source.thumbnail.toPNG(),
								name: source.name,
								id: source.display_id
							});
						}
					}
				});
				log.info('screenshot data', screens);
				return screens;
			})
			.catch((err) => {
				console.log('screenshot electron render error', err);
				return [];
			});
	}

	async getActivities(arg) {
		let windowEvents: any = [];
		let chromeEvent: any = [];
		let firefoxEvent: any = [];
		try {
			// window event
			windowEvents = await this.timeTrackerService.collectEvents(
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
			...firefoxEvent,
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
				source: 'DESKTOP',
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
		const afkTime: number = await this.getAfk(arg);
		const duration = arg.timeUpdatePeriod * 60 - afkTime;
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
				timeLogs: timeLogs,
			});
			this.electronService.ipcRenderer.send('remove_aw_local_data', {
				idsAw: arg.idsAw,
			});
			this.electronService.ipcRenderer.send(
				'remove_wakatime_local_data',
				{
					idsWakatime: arg.idsWakatime,
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
			} catch (error) {}
			const timeSlotId = resActivities.id;
			this.getLastTimeSlotImage({
				...arg,
				token: this.token,
				apiHost: this.apiHost,
				timeSlotId,
			});
			this.electronService.ipcRenderer.send('create-synced-interval', {
				...paramActivity,
				remoteId: timeSlotId,
				b64Imgs: screenshotImg.map((img) => {
					this.localImage(this.buffToB64(img));
					return {
						b64img: this.buffToB64(img),
						fileName: this.fileNameFormat(img),
					};
				}),
			});
		} catch (error) {
			console.log('error send to api timeslot', error);
			this.electronService.ipcRenderer.send('failed_save_time_slot', {
				params: JSON.stringify({
					...paramActivity,
					b64Imgs: screenshotImg.map((img) => {
						return {
							b64img: this.buffToB64(img),
							fileName: this.fileNameFormat(img),
						};
					}),
				}),
				message: error.message,
			});

			this.electronService.ipcRenderer.send('failed_synced_timeslot', {
				params: {
					...paramActivity,
					b64Imgs: screenshotImg.map((img) => {
						return {
							b64img: this.buffToB64(img),
							fileName: this.fileNameFormat(img),
						};
					}),
				},
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
					fileName: fileName,
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
					timeSlotId,
				}),
				message: error.message,
				type: 'screenshot',
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
		this._isRefresh$.next(true);
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
		this.isAddTask =
			!this._isOffline && this._hasTaskPermission && !this.start;
	}

	closeAddTask(e) {
		this.isAddTask = false;
		this.electronService.ipcRenderer.send('refresh-timer');
	}

	callbackNewTask(e) {
		if (e.isSuccess) {
			this.toastrService.show(e.message, `Success`, {
				status: 'success',
			});
			this.electronService.ipcRenderer.send('refresh-timer');
		} else {
			this.toastrService.show(e.message, `Warning`, {
				status: 'danger',
			});
		}
	}

	showErrorMessage(msg) {
		this.toastrService.show(`${msg}`, `Warning`, {
			status: 'danger',
		});
	}

	/**
	 * Check if user have required authorization to use time tracker
	 */
	private _passedAllAuthorizations(): boolean {
		let isPassed: boolean = false;
		// Verify if tracking is enabled
		if (!this.userData.employee.isTrackingEnabled) {
			this.toastrService.show(
				"Your can't run timer for the moment",
				`Warning`,
				{
					status: 'danger',
				}
			);
			isPassed = false;
		}
		// Verify work status of user
		else if (
			!this.userData.employee.startedWorkOn ||
			!this.userData.employee.isActive ||
			this.userData.employee.workStatus
		) {
			// Verify if user are already started to work for organization, if yes you can run time tracker else no
			if (!this.userData.employee.startedWorkOn) {
				this.toastrService.show(
					'Your are not authorized to work',
					`Warning`,
					{
						status: 'danger',
					}
				);
			}
			// Verify if user are deleted for organization, if yes can't run time tracker
			if (
				this.userData.employee.startedWorkOn &&
				!this.userData.employee.isActive
			) {
				this.toastrService.show(
					'Your account it already deleted',
					`Warning`,
					{
						status: 'danger',
					}
				);
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

	public get isOffline$(): Observable<boolean> {
		return this._isOffline$.asObservable();
	}

	public toggle(event: boolean) {
		this._isOffline$.next(this._isOffline);
	}

	public get inQueue$(): Observable<number> {
		return this._inQueue$.asObservable();
	}

	public get isRefresh$(): Observable<boolean> {
		return this._isRefresh$.asObservable();
	}

	private _mappingScreenshots(args: any[]) {
		let screenshots = args.map((arg) => {
			const imgUrl = 'data:image/png;base64,' + arg.screenshots[0].b64img;
			return {
				textTime: moment(arg.recordedAt).fromNow(),
				createdAt: arg.recordedAt,
				recordedAt: arg.recordedAt,
				fullUrl: imgUrl,
				thumbUrl: imgUrl,
			};
		});
		if (screenshots.length > 0) {
			screenshots = _.sortBy(screenshots, 'recordedAt').reverse();
			const [lastCaptureScreen] = screenshots;
			console.log('Last Capture Screen:', lastCaptureScreen);
			this.lastScreenCapture$.next(lastCaptureScreen);
			this.screenshots$.next(screenshots);
			console.log('screenshots from db', screenshots);
			this.localImage(this.lastScreenCapture);
		}
	}

	/**
	 * It takes a date and returns a string
	 * @param {Date} date - The date to humanize
	 * @returns A string
	 */

	public humanize(date: Date): string {
		return moment(date).fromNow();
	}

	/**
	 * It returns the project that matches the projectSelect value
	 * @returns The project that matches the projectSelect id.
	 */
	public get selectedProject() {
		const projects = this._projects$.getValue();
		return projects.filter(
			(project) => project.id === this.projectSelect
		)[0];
	}

	/* Adding a new project to the list of projects. */
	public addProject = async (name: string) => {
		try {
			const { tenantId } = this.userData;
			const organizationId = this.userOrganization.id;
			const request = {
				name,
				organizationId,
				tenantId,
				owner: ProjectOwnerEnum.CLIENT,
				...(this.organizationContactId
					? { organizationContactId: this.organizationContactId }
					: {}),
			};

			request['members'] = [{ ...this.userData.employee }];

			console.log('Request', request);
			const project = await this.timeTrackerService.createNewProject(
				request,
				{
					...this.userData,
					token: this.token,
					apiHost: this.apiHost,
				}
			);
			const projects = this._projects$.getValue();
			this._projects$.next(projects.concat([project]));
			this.projectSelect = project.id;
			this.toastrService.success('Project added successfully', 'Gauzy');
		} catch (error) {
			console.log(error);
			this.toastrService.danger(
				'An error occurred',
				'Gauzy Desktop Timer'
			);
		}
	};

	/* Adding a new task to the list of tasks. */
	public addNewTask = async (title: ITask['title']) => {
		if (!title) {
			return;
		}
		const { tenantId } = this.userData;
		const organizationId = this.userOrganization.id;
		const data = {
			tenantId,
			organizationId,
			token: this.token,
			apiHost: this.apiHost,
			projectId: this.projectSelect,
		};
		try {
			const member: any = { ...this.userData.employee };
			const task: any = await this.timeTrackerService.saveNewTask(data, {
				title,
				organizationId,
				tenantId,
				status: TaskStatusEnum.IN_PROGRESS,
				dueDate: moment().add(1, 'day').utc().toDate(),
				estimate: 3600,
				...(member.id && { members: [member] }),
				...(this.projectSelect && {
					projectId: this.projectSelect,
					project: this.selectedProject,
				}),
			});
			const tasks = this._tasks$.getValue();
			this._tasks$.next(tasks.concat(task));
			this.taskSelect = task.id;
			this.toastrService.success(
				'Task added successfully',
				'Gauzy Desktop Timer'
			);
		} catch (error) {
			this.toastrService.danger(
				'An error occurred',
				'Gauzy Desktop Timer'
			);
		}
	};

	/* Creating a new contact for the organization. */
	public addContact = async (name: IOrganizationContact['name']) => {
		try {
			const { tenantId } = this.userData;
			const { id: organizationId } = this.userOrganization;
			const member: any = { ...this.userData.employee };
			const payload = {
				name,
				organizationId,
				tenantId,
				contactType: ContactType.CLIENT,
				...(member.id && { members: [member] }),
			};
			const contact = await this.timeTrackerService.createNewContact(
				payload,
				{
					...this.userData,
					token: this.token,
					apiHost: this.apiHost,
				}
			);
			const contacts = this._organizationContacts$.getValue();
			this._organizationContacts$.next(contacts.concat([contact]));
			this.organizationContactId = contact.id;
			this.toastrService.success('Client added successfully', 'Gauzy');
		} catch (error) {
			this.toastrService.danger('An error occurred', 'Gauzy');
		}
	};

	public selectOrganization(organization: IOrganization) {
		console.log('Organization', organization);
	}
}
