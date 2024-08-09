import {
	AfterViewInit,
	Component,
	ElementRef,
	forwardRef,
	Inject,
	NgZone,
	OnInit,
	TemplateRef,
	ViewChild
} from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import {
	ContactType,
	IOrganization,
	IOrganizationContact,
	IOrganizationTeam,
	ITask,
	ITasksStatistics,
	ITaskStatus,
	ITaskUpdateInput,
	PermissionsEnum,
	ProjectOwnerEnum,
	TaskStatusEnum
} from '@gauzy/contracts';
import { compressImage, distinctUntilChange } from '@gauzy/ui-core/common';
import { NbDialogRef, NbDialogService, NbIconLibraries, NbToastrService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { Angular2SmartTableComponent, Cell, LocalDataSource } from 'angular2-smart-table';
import * as moment from 'moment';
import 'moment-duration-format';
import {
	asapScheduler,
	asyncScheduler,
	BehaviorSubject,
	concatMap,
	debounceTime,
	filter,
	firstValueFrom,
	from,
	lastValueFrom,
	Observable,
	of,
	Subject,
	tap
} from 'rxjs';
import * as _ from 'underscore';
import { AlwaysOnService, AlwaysOnStateEnum } from '../always-on/always-on.service';
import { AuthStrategy } from '../auth';
import { GAUZY_ENV } from '../constants';
import { ElectronService, LoggerService } from '../electron/services';
import { ImageViewerService } from '../image-viewer/image-viewer.service';
import { ActivityWatchViewService } from '../integrations';
import { LanguageElectronService } from '../language/language-electron.service';
import {
	InterruptedSequenceQueue,
	ISequence,
	SequenceQueue,
	TimeSlotQueueService,
	ViewQueueStateUpdater
} from '../offline-sync';
import {
	ErrorHandlerService,
	NativeNotificationService,
	Store,
	TimeTrackerDateManager,
	TimeZoneManager,
	ToastrNotificationService,
	ZoneEnum
} from '../services';
import { TasksComponent } from '../tasks/tasks.component';
import { TaskDurationComponent, TaskProgressComponent } from './task-render';
import { TaskRenderCellComponent } from './task-render/task-render-cell/task-render-cell.component';
import { TaskStatusComponent } from './task-render/task-status/task-status.component';
import { IRemoteTimer } from './time-tracker-status/interfaces';
import { TimeTrackerStatusService } from './time-tracker-status/time-tracker-status.service';
import { TimeTrackerService } from './time-tracker.service';

enum TimerStartMode {
	MANUAL = 'manual',
	REMOTE = 'remote',
	STOP = 'stop'
}

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
	private _lastTotalWorkedToday$: BehaviorSubject<number> = new BehaviorSubject(0);
	private _lastTotalWorkedWeek$: BehaviorSubject<number> = new BehaviorSubject(0);
	private _permissions$: Subject<any> = new Subject();
	private _lastTime = 0;
	private _isLockSyncProcess = false;
	private _startMode = TimerStartMode.STOP;
	private _isSpecialLogout = false;
	private _isRestartAndUpdate = false;
	private _isOpenDialog = false;
	private _dialog: NbDialogRef<any> = null;
	private _timeZoneManager = TimeZoneManager;
	private _remoteSleepLock = false;
	private _isReady = false;
	@ViewChild('dialogOpenBtn') btnDialogOpen: ElementRef<HTMLElement>;
	public start$: BehaviorSubject<boolean> = new BehaviorSubject(false);
	userData: any;
	organization: any = {};
	projectSelect = null;
	taskSelect = null;
	teamSelect = null;
	errors: any = {};
	note: String = null;
	public todayDuration$: BehaviorSubject<any> = new BehaviorSubject('--h --m');
	public weeklyDuration$: BehaviorSubject<any> = new BehaviorSubject('--h --m');
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
	isProcessingEnabled = false;
	appSetting$: BehaviorSubject<any> = new BehaviorSubject(null);
	isExpand$: BehaviorSubject<boolean> = new BehaviorSubject(false);
	isCollapse$: BehaviorSubject<boolean> = new BehaviorSubject(true);
	dialogType = {
		deleteLog: {
			name: 'deleteLog',
			message: 'TIMER_TRACKER.DIALOG.REMOVE_SCREENSHOT'
		},
		changeClient: {
			name: 'changeClient',
			message: 'TIMER_TRACKER.DIALOG.CHANGE_CLIENT'
		},
		timeTrackingOption: {
			name: 'timeTrackingOption',
			message: 'TIMER_TRACKER.DIALOG.RESUME_TIMER'
		}
	};
	timerStatus: any;
	expandIcon = 'arrow-right';
	smartTableSettings: object;
	tableData = [];
	isTrackingEnabled = true;
	isAddTask = false;
	sound: any = null;
	public hasTaskPermission$: BehaviorSubject<boolean> = new BehaviorSubject(false);
	public hasProjectPermission$: BehaviorSubject<boolean> = new BehaviorSubject(false);
	public hasContactPermission$: BehaviorSubject<boolean> = new BehaviorSubject(false);

	constructor(
		private electronService: ElectronService,
		private timeTrackerService: TimeTrackerService,
		private dialogService: NbDialogService,
		private toastrService: NbToastrService,
		private sanitize: DomSanitizer,
		private _ngZone: NgZone,
		private iconLibraries: NbIconLibraries,
		private _errorHandlerService: ErrorHandlerService,
		private _nativeNotifier: NativeNotificationService,
		private _toastrNotifier: ToastrNotificationService,
		private _store: Store,
		private _loggerService: LoggerService,
		private _timeTrackerStatus: TimeTrackerStatusService,
		private _timeSlotQueueService: TimeSlotQueueService,
		private _imageViewerService: ImageViewerService,
		private _authStrategy: AuthStrategy,
		private _translateService: TranslateService,
		private _alwaysOnService: AlwaysOnService,
		@Inject(GAUZY_ENV)
		private readonly _environment: any,
		private readonly _activityWatchViewService: ActivityWatchViewService,
		private readonly _languageElectronService: LanguageElectronService
	) {
		this.iconLibraries.registerFontPack('font-awesome', {
			packClass: 'fas',
			iconClassPrefix: 'fa'
		});
		this._permissions$
			.pipe(
				filter((permissions: any[]) => permissions.length > 0),
				tap((permissions: any[]) => {
					this.hasTaskPermission$.next(permissions.includes(PermissionsEnum.ORG_TASK_ADD));
					this.hasProjectPermission$.next(permissions.includes(PermissionsEnum.ORG_PROJECT_ADD));
					this.hasContactPermission$.next(permissions.includes(PermissionsEnum.ORG_CONTACT_EDIT));
				}),
				untilDestroyed(this)
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

	private get _sourceData(): LocalDataSource {
		return this._sourceData$.getValue();
	}

	private get _hasTaskPermission(): boolean {
		return this.hasTaskPermission$.getValue();
	}

	private get _isOffline(): boolean {
		return this._isOffline$.getValue();
	}

	private get _lastTotalWorkedToday(): number {
		return this._lastTotalWorkedToday$.getValue();
	}

	private get _lastTotalWorkedWeek(): number {
		return this._lastTotalWorkedWeek$.getValue();
	}

	private _teams$: BehaviorSubject<IOrganizationTeam[]> = new BehaviorSubject([]);

	public get teams$(): Observable<IOrganizationTeam[]> {
		return this._teams$.asObservable();
	}

	public get teams(): IOrganizationTeam[] {
		return this._teams$.getValue();
	}

	public get selectedTeam(): IOrganizationTeam {
		const [selected] = this.teams.filter((team: IOrganizationTeam) => team.id === this.teamSelect);
		return selected;
	}

	public get tasks(): ITask[] {
		return this._tasks$.getValue();
	}

	public get selectedTask(): ITask {
		const [selected] = this.tasks.filter((task: ITask) => task.id === this.taskSelect);
		return selected;
	}

	private _taskTable: Angular2SmartTableComponent;

	@ViewChild('taskTable') set taskTable(content: Angular2SmartTableComponent) {
		if (content) {
			this._taskTable = content;
			this._onChangedSource();
		}
	}

	private _timeRun$: BehaviorSubject<string> = new BehaviorSubject('00:00:00');

	public get timeRun$(): Observable<string> {
		return this._timeRun$.asObservable();
	}

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

	private _sourceData$: BehaviorSubject<LocalDataSource>;

	public get sourceData$(): Observable<LocalDataSource> {
		return this._sourceData$.asObservable();
	}

	private _isOffline$: BehaviorSubject<boolean> = new BehaviorSubject(false);

	public get isOffline$(): Observable<boolean> {
		return this._isOffline$.asObservable();
	}

	private _inQueue$: BehaviorSubject<ViewQueueStateUpdater> = new BehaviorSubject({ size: 0, inProgress: false });

	public get inQueue$(): Observable<ViewQueueStateUpdater> {
		return this._inQueue$.asObservable();
	}

	private _isRefresh$: BehaviorSubject<boolean> = new BehaviorSubject(false);

	public get isRefresh$(): Observable<boolean> {
		return this._isRefresh$.asObservable();
	}

	private _weeklyLimit$: BehaviorSubject<number> = new BehaviorSubject(Infinity);

	public get weeklyLimit$(): Observable<number> {
		return this._weeklyLimit$.asObservable();
	}

	private _isOver$: BehaviorSubject<boolean> = new BehaviorSubject(false);

	public get isOver$(): Observable<boolean> {
		return this._isOver$.asObservable();
	}

	public get start(): boolean {
		return this.start$.getValue();
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

	public get inQueue(): ViewQueueStateUpdater {
		return this._inQueue$.getValue();
	}

	/**
	 * It returns the project that matches the projectSelect value
	 * @returns The project that matches the projectSelect id.
	 */
	public get selectedProject() {
		const projects = this._projects$.getValue();
		return projects.filter((project) => project.id === this.projectSelect)[0];
	}

	public get _weeklyLimit(): number {
		return this._weeklyLimit$.getValue();
	}

	public get isRemoteTimer(): boolean {
		return this._startMode === TimerStartMode.REMOTE;
	}

	private async resetAtMidnight() {
		if (TimeTrackerDateManager.isMidnight) {
			try {
				await this.restart();
			} catch (error) {
				this._errorHandlerService.handleError(error);
			}
		}
	}

	private merge(tasks: ITask[], statistics: ITasksStatistics[]): (ITask & ITasksStatistics)[] {
		let arr: (ITask & ITasksStatistics)[] = [];
		arr = arr.concat(statistics, tasks);
		return arr.reduce((result, current) => {
			const existing = result.find((item: any) => item.id === current.id);
			if (existing) {
				const updatedAtMoment = moment(existing?.updatedAt, moment.ISO_8601).utc(true);
				Object.assign(
					existing,
					current,
					updatedAtMoment.isAfter(current?.updatedAt)
						? {
								updatedAt: updatedAtMoment.toISOString()
						  }
						: {}
				);
			} else {
				result.push(current);
			}
			return result.filter((task) => !!task?.id);
		}, []);
	}

	private countDuration(count, isForcedSync?: boolean): void {
		if (!this.start || isForcedSync) {
			this._lastTotalWorkedToday$.next(count.todayDuration);
			this._lastTotalWorkedWeek$.next(count.weekDuration);
			this._alwaysOnService.update('00:00:00', this._lastTotalWorkedToday);
		}
	}

	private async _deleteSyncedTimeslot() {
		try {
			await this.getTimerStatus(this.argFromMain);
			if (this.timerStatus.running) {
				await this.toggleStart(false);
			}
			const res = await this.timeTrackerService.deleteTimeSlot({
				...this.argFromMain,
				timeSlotId: this.selectedTimeSlot.id
			});
			if (res) {
				// Delete selected time slot and return last time slot
				const timeSlotId = await this.electronService.ipcRenderer.invoke(
					'DELETE_TIME_SLOT',
					this.selectedTimeSlot.id
				);
				this.selectedTimeSlot.id = timeSlotId;
				// Refresh screen
				await Promise.allSettled([
					this.getTodayTime(this.argFromMain, true),
					this.getLastTimeSlotImage({ timeSlotId })
				]);
			}
		} catch (e) {
			console.log('error on delete', e);
		}
	}

	/**
	 * Check if user have required authorization to use time tracker
	 */
	private _passedAllAuthorizations(): boolean {
		let isPassed = false;
		// Verify if tracking is enabled
		if (!this.userData?.employee?.isTrackingEnabled) {
			this.toastrService.show(this._translateService.instant('TIMER_TRACKER.TOASTR.CANT_RUN_TIMER'), `Warning`, {
				status: 'danger'
			});
			isPassed = false;
		}
		// Verify work status of user
		else if (
			!this.userData?.employee?.startedWorkOn ||
			!this.userData?.employee?.isActive ||
			this.userData?.employee?.workStatus
		) {
			// Verify if user are already started to work for organization, if yes you can run time tracker else no
			if (!this.userData?.employee?.startedWorkOn) {
				this.toastrService.show(
					this._translateService.instant('TIMER_TRACKER.TOASTR.NOT_AUTHORIZED'),
					`Warning`,
					{
						status: 'danger'
					}
				);
			}
			// Verify if user are deleted for organization, if yes can't run time tracker
			if (this.userData?.employee?.startedWorkOn && !this.userData?.employee?.isActive) {
				this.toastrService.show(
					this._translateService.instant('TIMER_TRACKER.TOASTR.ACCOUNT_DELETED'),
					`Warning`,
					{
						status: 'danger'
					}
				);
			}
			isPassed = false;
		} else isPassed = true;
		return isPassed;
	}

	private _onChangedSource(): void {
		this._taskTable.source.onChangedSource
			.pipe(
				tap(() => this._clearItem()),
				tap(() => {
					if (this.taskSelect) {
						this._taskTable.grid.dataSet.getRows().map((row) => {
							if (row.getData().id === this.taskSelect) {
								return this._taskTable.grid.dataSet.selectRow(row);
							}
						});
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _clearItem(): void {
		if (this._taskTable && this._taskTable.grid) {
			this._taskTable.grid.dataSet['willSelect'] = 'indexed';
			this._taskTable.grid.dataSet.deselectAll();
		}
	}

	private async _mappingScreenshots(args: any[]): Promise<void> {
		try {
			let screenshots = await Promise.all(
				args.map(async (arg) => {
					if (!arg.screenshots.length) return null;
					const fullUrl = 'data:image/png;base64,' + arg.screenshots[0].b64img;
					const thumbUrl = await compressImage(fullUrl, 320, 200);
					return {
						textTime: moment(arg.recordedAt).fromNow(),
						createdAt: arg.recordedAt,
						recordedAt: arg.recordedAt,
						id: arg.id,
						fullUrl,
						thumbUrl
					};
				})
			);
			screenshots = screenshots.filter((screenshot) => !!screenshot);
			if (screenshots.length > 0) {
				const [lastCaptureScreen] = screenshots;
				console.log('Last Capture Screen:', lastCaptureScreen);
				this.lastScreenCapture$.next(lastCaptureScreen);
				this.screenshots$.next(screenshots);
				console.log('screenshots from db', screenshots);
				await this.localImage(this.lastScreenCapture.thumbUrl);
			}
		} catch (error) {
			this._errorHandlerService.handleError(error);
		}
	}

	private async _toggle(timer: any, onClick: boolean) {
		try {
			const { lastTimer, isStarted } = timer;

			const isRemote =
				this._timeTrackerStatus.remoteTimer &&
				this.xor(!isStarted, this._timeTrackerStatus.remoteTimer.running) &&
				this._startMode === TimerStartMode.REMOTE;

			const params = {
				token: this.token,
				note: this.note,
				projectId: this.projectSelect,
				taskId: this.taskSelect,
				organizationId: this._store.organizationId,
				tenantId: this._store.tenantId,
				organizationContactId: this.organizationContactId,
				apiHost: this.apiHost
			};

			let timelog = null;

			console.log('[TIMER_STATE]', lastTimer);

			if (isStarted) {
				if (!this._isOffline && !this._remoteSleepLock) {
					try {
						timelog = isRemote
							? this._timeTrackerStatus.remoteTimer.lastLog
							: await this.timeTrackerService.toggleApiStart({
									...lastTimer,
									...params
							  });
					} catch (error) {
						lastTimer.isStartedOffline = true;
						this._loggerService.error(error);
					}
				}
			} else {
				if (!this._isOffline) {
					try {
						timelog =
							isRemote ||
							this._remoteSleepLock ||
							(this.isRemoteTimer && (this._isSpecialLogout || this.quitApp))
								? this._timeTrackerStatus.remoteTimer.lastLog
								: await this.timeTrackerService.toggleApiStop({
										...lastTimer,
										...params
								  });
					} catch (error) {
						lastTimer.isStoppedOffline = true;
						this._loggerService.error(error);
					}
				}
			}

			this.isProcessingEnabled = false;

			asapScheduler.schedule(async () => {
				try {
					await this.electronService.ipcRenderer.invoke('UPDATE_SYNCED_TIMER', {
						lastTimer: timelog,
						...lastTimer
					});
					await this.getTimerStatus(params);
				} catch (error) {
					this._errorHandlerService.handleError(error);
				}
			});
		} catch (error) {
			let messageError = error.message;
			if (messageError.includes('Http failure response')) {
				messageError = `Can't connect to api server`;
			} else {
				messageError = 'Internal server error';
			}
			this.toastrService.show(messageError, `Warning`, {
				status: 'danger'
			});
			this._loggerService.info(`Timer Toggle Catch: ${moment().format()}`, error);
			this.loading = false;
			this.isProcessingEnabled = false;
		}
	}

	private _loadSmartTableSettings(): void {
		this.smartTableSettings = {
			columns: {
				title: {
					title: this._translateService.instant('TIMER_TRACKER.TASK'),
					type: 'custom',
					renderComponent: TaskRenderCellComponent,
					width: '40%',
					componentInitFunction: (instance: TaskRenderCellComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
					}
				},
				duration: {
					title: this._translateService.instant('TIMESHEET.DURATION'),
					type: 'custom',
					renderComponent: TaskDurationComponent,
					componentInitFunction: (instance: TaskDurationComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
					}
				},
				taskProgress: {
					title: this._translateService.instant('MENU.IMPORT_EXPORT.PROGRESS'),
					type: 'custom',
					renderComponent: TaskProgressComponent,
					width: '192px',
					componentInitFunction: (instance: TaskProgressComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.updated.subscribe({
							next: async (estimate: number) => {
								const { tenantId, organizationId } = this._store;
								const id = instance.task.id;
								const title = instance.task.title;
								const status = instance.task.status;
								const taskUpdateInput: ITaskUpdateInput = {
									organizationId,
									tenantId,
									estimate,
									status,
									title
								};
								await this.timeTrackerService.updateTask(id, taskUpdateInput);
								this._toastrNotifier.success(this._translateService.instant('TOASTR.MESSAGE.UPDATED'));
								this.refreshTimer();
							},
							error: (err: any) => {
								console.warn(err);
							}
						});
					}
				},
				taskStatus: {
					title: this._translateService.instant('SM_TABLE.STATUS'),
					type: 'custom',
					renderComponent: TaskStatusComponent,
					componentInitFunction: (instance: TaskStatusComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.updated.subscribe({
							next: async (taskStatus: ITaskStatus) => {
								const { tenantId, organizationId } = this._store;
								const id = instance.task.id;
								const title = instance.task.title;
								const status = taskStatus.name as TaskStatusEnum;
								const taskUpdateInput: ITaskUpdateInput = {
									organizationId,
									tenantId,
									status,
									title,
									taskStatus
								};
								await this.timeTrackerService.updateTask(id, taskUpdateInput);
								this._toastrNotifier.success(this._translateService.instant('TOASTR.MESSAGE.UPDATED'));
								this.refreshTimer();
							},
							error: (err: any) => {
								console.warn(err);
							}
						});
					}
				}
			},
			hideSubHeader: true,
			actions: false,
			noDataMessage: this._translateService.instant('SM_TABLE.NO_DATA.TASK'),
			pager: {
				display: true,
				perPage: 10,
				page: 1
			}
		};
	}

	private async loadStatuses(): Promise<void> {
		if (!this._store.organizationId && !this._store.tenantId) {
			return;
		}

		const { organizationId, tenantId } = this._store;

		this._store.statuses = await this.timeTrackerService.statuses({
			tenantId,
			organizationId,
			...(this.projectSelect
				? {
						projectId: this.projectSelect
				  }
				: {})
		});
	}

	ngOnInit(): void {
		this._sourceData$ = new BehaviorSubject(new LocalDataSource(this.tableData));

		this._sourceData.setSort([{ field: 'updatedAt', direction: 'desc' }]);

		this.tasks$
			.pipe(
				tap(async (tasks) => {
					if (tasks.length > 0) {
						tasks = tasks.map((row) => ({ ...row, isSelected: row.id === this.taskSelect }));
					} else {
						tasks = [];
						this.taskSelect = null;
					}
					this.tableData = tasks;
					await this._sourceData.load(this.tableData);
				}),
				untilDestroyed(this)
			)
			.subscribe();

		this._lastTotalWorkedToday$
			.pipe(
				tap((todayDuration: number) => {
					this.todayDuration$.next(
						moment.duration(todayDuration, 'seconds').format('hh[h] mm[m]', { trim: false, trunc: true })
					);
					this.electronService.ipcRenderer.send('update_tray_time_update', this.todayDuration);
					this.electronService.ipcRenderer.send('update_tray_time_title', {
						timeRun: moment.duration(todayDuration, 'seconds').format('hh:mm:ss', { trim: false })
					});
				}),
				untilDestroyed(this)
			)
			.subscribe();

		this._timeRun$
			.pipe(
				tap((current: string) => {
					this._alwaysOnService.update(current, this._lastTotalWorkedToday);
				}),
				untilDestroyed(this)
			)
			.subscribe();

		this._lastTotalWorkedWeek$
			.pipe(
				tap((weekDuration: number) => {
					this.weeklyDuration$.next(
						moment.duration(weekDuration, 'seconds').format('hh[h] mm[m]', { trim: false, trunc: true })
					);
					this._isOver$.next(weekDuration > this._weeklyLimit * 3600);
				}),
				untilDestroyed(this)
			)
			.subscribe();

		this.start$
			.pipe(
				tap((isStart: boolean) => {
					this._alwaysOnService.run(isStart ? AlwaysOnStateEnum.STARTED : AlwaysOnStateEnum.STOPPED);
					this._activityWatchViewService.isTimerRunning$.next(isStart);
				}),
				filter((isStart: boolean) => !isStart),
				tap(() => {
					this._timeRun$.next('00:00:00');
					this._lastTime = 0;
				}),
				untilDestroyed(this)
			)
			.subscribe();

		this._timeTrackerStatus.external$
			.pipe(
				filter(
					(remoteTimer: IRemoteTimer) =>
						this.xor(this.start, remoteTimer.running) &&
						!this._isLockSyncProcess &&
						this._isReady &&
						this.inQueue.size === 0
				),
				tap(async (remoteTimer: IRemoteTimer) => {
					this.projectSelect = remoteTimer.lastLog.projectId;
					this.taskSelect = remoteTimer.lastLog.taskId;
					this.note = remoteTimer.lastLog.description;
					this.teamSelect = remoteTimer.lastLog.organizationTeamId;
					this.organizationContactId = remoteTimer.lastLog.organizationContactId;
					if (!this.isProcessingEnabled) {
						await this.toggleStart(remoteTimer.running, false);
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();

		this._timeSlotQueueService.updater$
			.pipe(
				distinctUntilChange(),
				tap((interval) => from(this.getLastTimeSlotImage(interval))),
				untilDestroyed(this)
			)
			.subscribe();

		this._timeSlotQueueService.viewQueueStateUpdater$
			.pipe(
				tap(({ inProgress }) =>
					this._inQueue$.next({
						...this.inQueue,
						inProgress
					})
				),
				untilDestroyed(this)
			)
			.subscribe();

		this.userOrganization$
			.pipe(
				tap((organization: IOrganization) => (TimeTrackerDateManager.organization = organization)),
				untilDestroyed(this)
			)
			.subscribe();

		this._alwaysOnService.state$
			.pipe(
				filter((state: AlwaysOnStateEnum) => state === AlwaysOnStateEnum.LOADING),
				concatMap(() => this.toggleStart(!this.start, true)),
				untilDestroyed(this)
			)
			.subscribe();

		this._loadSmartTableSettings();
	}

	public xor(a: boolean, b: boolean): boolean {
		return (a && !b) || (!a && b);
	}

	ngAfterViewInit(): void {
		this.electronService.ipcRenderer.on('timer_push', (event, arg) =>
			this._ngZone.run(async () => {
				await this.setTime(arg);
			})
		);

		this.electronService.ipcRenderer.on('timer_tracker_show', (event, arg) =>
			this._ngZone.run(async () => {
				if (!this._store.user?.employee) return;
				this._isOffline$.next(arg.isOffline ? arg.isOffline : this._isOffline);
				this._store.host = arg.apiHost;
				this.apiHost = arg.apiHost;
				this.argFromMain = arg;
				this.taskSelect = arg.taskId;
				this.projectSelect = arg.projectId;
				this.organizationContactId = arg.organizationContactId;
				this.teamSelect = arg.organizationTeamId;
				this.token = arg.token;
				this.note = arg.note;
				this._activityWatchViewService.aw$.next(!!arg.aw?.isAw);
				this.appSetting$.next(arg.settings);
				this._timeZoneManager.changeZone(this.appSetting?.zone || ZoneEnum.LOCAL);
				if (!this._isReady && this.appSetting?.alwaysOn) {
					this.electronService.ipcRenderer.send('show_ao');
				}
				const parallelizedTasks: Promise<void>[] = [
					this.loadStatuses(),
					this.getTeams(arg),
					this.getClient(arg),
					this.getProjects(arg),
					this.getTask(arg),
					this.getTodayTime(arg),
					this.setTimerDetails()
				];
				if (arg.timeSlotId) {
					parallelizedTasks.push(this.getLastTimeSlotImage(arg));
				}
				await Promise.allSettled(parallelizedTasks);
				this._isReady = true;
				this._isRefresh$.next(false);
				if (!this._isLockSyncProcess && this.inQueue.size > 0) {
					this.electronService.ipcRenderer.send('check-interrupted-sequences');
				}
			})
		);

		this.electronService.ipcRenderer.on('start_from_tray', async (event, arg) =>
			this._ngZone.run(async () => {
				this.taskSelect = arg.taskId;
				this.projectSelect = arg.projectId;
				this.teamSelect = arg.organizationTeamId;
				this.note = arg.note;
				this._activityWatchViewService.aw$.next(!!arg.aw?.isAw);
				await this.setTimerDetails();
				await this.toggleStart(true);
			})
		);

		this.electronService.ipcRenderer.on('stop_from_tray', (event, arg) =>
			this._ngZone.run(async () => {
				// Check if arg is defined and has the quitApp property set to true
				if (arg?.quitApp) {
					// Set the quitApp flag to true
					this.quitApp = true;
				}

				// Check if quitApp flag is already set, and if so, force stop the timer and return
				if (this.quitApp) {
					await this.stopTimer(true, true);
					return;
				}

				console.log('stop_from_tray this.start=', this.start);

				// Check if the start flag is set, and if so, toggle the start state to false
				if (this.start) {
					await this.toggleStart(false);
				} else {
					console.log('this.start is false, doing nothing.');
				}
			})
		);

		this.electronService.ipcRenderer.on('set_project_task_reply', (event, arg) =>
			this._ngZone.run(async () => {
				await this.setProject(arg.projectId);
				this.setTask(arg.taskId);
				this.note = arg.note;
				this._activityWatchViewService.aw$.next(arg.aw && arg.aw.isAw ? arg.aw.isAw : false);
			})
		);

		this.electronService.ipcRenderer.on('take_screenshot', (event, arg) =>
			this._ngZone.run(async () => {
				try {
					this._loggerService.info(`Take Screenshot::`, arg);
					const screens = [];
					const thumbSize = this.determineScreenshot(arg.screenSize);
					const sources = await this.electronService.desktopCapturer.getSources({
						types: ['screen'],
						thumbnailSize: thumbSize
					});
					sources.forEach((source) => {
						this._loggerService.info(`screenshot_res:`, JSON.stringify(source));
						screens.push({
							img: source.thumbnail.toPNG(),
							name: source.name,
							id: source.display_id
						});
						this._loggerService.info('screenshot data::', JSON.stringify(screens));
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
				} catch (error) {
					this._errorHandlerService.handleError(error);
				}
			})
		);

		this.electronService.ipcRenderer.on('refresh_time_log', (event, arg) =>
			this._ngZone.run(async () => {
				await this.getTodayTime(arg);
			})
		);

		this.electronService.ipcRenderer.on('show_last_capture', (event, arg) =>
			this._ngZone.run(async () => {
				await this.getLastTimeSlotImage(arg);
			})
		);

		this.electronService.ipcRenderer.on('last_capture_local', (event, arg) =>
			this._ngZone.run(() => {
				console.log('Last Capture Screenshot:');
				this.lastScreenCapture$.next({
					fullUrl: this.sanitize.bypassSecurityTrustUrl(arg.fullUrl),
					thumbUrl: this.sanitize.bypassSecurityTrustUrl(arg.fullUrl),
					textTime: moment().fromNow(),
					createdAt: Date.now(),
					recordedAt: Date.now()
				});
				this.screenshots$.next([...this.screenshots]);
			})
		);

		this.electronService.ipcRenderer.on('get_user_detail', (event, arg) =>
			this._ngZone.run(async () => {
				try {
					const res = await this.timeTrackerService.getUserDetail();
					if (res) {
						event.sender.send('user_detail', res);
					}
				} catch (error) {
					console.log('[User Error]: ', error);
				}
			})
		);

		this.electronService.ipcRenderer.on('update_setting_value', (event, arg) =>
			this._ngZone.run(() => {
				this.appSetting$.next(arg);
			})
		);

		this.electronService.ipcRenderer.on('device_sleep', () =>
			this._ngZone.run(async () => {
				if (this.start) await this.toggleStart(false);
			})
		);

		this.electronService.ipcRenderer.on('activity-proof-request', () => {
			this._ngZone.run(() => {
				this._dialog?.close();
				this._isOpenDialog = false;
			});
		});

		this.electronService.ipcRenderer.on('inactivity-result-not-accepted', (event, arg) =>
			this._ngZone.run(async () => {
				if (this.start) {
					await this.toggleStart(false);
					this._dialog?.close();
					this._isOpenDialog = false;
				}
			})
		);

		this.electronService.ipcRenderer.on('stop_from_inactivity_handler', () => {
			this._ngZone.run(async () => {
				if (this.start) await this.toggleStart(false);
			});
		});

		this.electronService.ipcRenderer.on('start_from_inactivity_handler', () => {
			this._ngZone.run(async () => {
				await this.toggleStart(true);
			});
		});

		this.electronService.ipcRenderer.on('device_wake_up', () =>
			this._ngZone.run(() => {
				if (!this._isOpenDialog) {
					const elBtn: HTMLElement = this.btnDialogOpen.nativeElement;
					elBtn.click();
					this._isOpenDialog = true;
				}
			})
		);

		this.electronService.ipcRenderer.on('timer_status', (event, arg) =>
			this._ngZone.run(async () => {
				await this.getTimerStatus(arg);
			})
		);

		this.electronService.ipcRenderer.on('timer_already_stop', (event, arg) =>
			this._ngZone.run(() => {
				this.loading = false;
			})
		);

		this.electronService.ipcRenderer.on('logout', (event, arg) =>
			this._ngZone.run(async () => {
				this._isRestartAndUpdate = arg;
				if (this.isExpand) this.expand();
				if (this.start && !this.isRemoteTimer) {
					this._isSpecialLogout = true;
					await this.stopTimer();
				}
				if (!this._isSpecialLogout) {
					await this.logout();
				}
			})
		);

		this.electronService.ipcRenderer.on('prepare_activities_screenshot', (event, arg) =>
			this._ngZone.run(async () => {
				await this.sendActivities(arg);
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
					this._errorHandlerService.handleError(error);
				}
			})
		);

		this.electronService.ipcRenderer.on('show_error_message', (event, arg) =>
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
			this._ngZone.run(async () => {
				await this.getTodayTime(arg);
			})
		);

		this.electronService.ipcRenderer.on('offline-handler', (event, isOffline) => {
			this._ngZone.run(() => {
				this._isOffline$.next(isOffline);
				this._loggerService.info('You switched to ' + (isOffline ? 'offline' : 'online') + ' mode now');
				if (!isOffline) {
					this.refreshTimer();
				}
			});
		});

		this.electronService.ipcRenderer.on('count-synced', (event, arg) => {
			this._ngZone.run(() => {
				this._inQueue$.next(arg);
			});
		});

		this.electronService.ipcRenderer.on('latest_screenshots', (event, args) => {
			this._ngZone.run(async () => {
				if (this._isOffline) {
					await this._mappingScreenshots(args);
				}
			});
		});

		this.electronService.ipcRenderer.on('backup-timers-no-synced', (event, args: ISequence[]) => {
			this._ngZone.run(async () => {
				if (this._isLockSyncProcess || this.isRemoteTimer) {
					this._inQueue$.next({
						...this.inQueue,
						inProgress: false
					});
					return;
				} else {
					this._isLockSyncProcess = true;
				}
				this._inQueue$.next({
					...this.inQueue,
					inProgress: true
				});
				console.log('🛠 - Preprocessing sequence');
				const sequenceQueue = new SequenceQueue(
					this.electronService,
					this._errorHandlerService,
					this._store,
					this._timeSlotQueueService,
					this.timeTrackerService,
					this._timeTrackerStatus
				);
				console.log('⌗', args);
				for (const arg of args) sequenceQueue.enqueue(arg);
				args = []; // empty the array
				console.log('🚀 - Begin processing sequence queue');
				await sequenceQueue.process();
				console.log('🚨 - End processing sequence queue');
				asapScheduler.schedule(async () => {
					try {
						await this.electronService.ipcRenderer.invoke('FINISH_SYNCED_TIMER');
						this._isLockSyncProcess = false;
						if (!this.start) {
							this.refreshTimer();
						} else {
							this.electronService.ipcRenderer.send('check-interrupted-sequences');
						}
						console.log('✅ - Finish synced');
					} catch (error) {
						this._errorHandlerService.handleError(error);
					}
				});
			});
		});

		if (!this._isReady) {
			this.electronService.ipcRenderer.send('time_tracker_ready');
		}

		this.electronService.ipcRenderer.on('remove_idle_time', (event, arg) => {
			this._ngZone.run(async () => {
				try {
					const { tenantId, organizationId } = this._store;
					const { employeeId } = this.userData;

					const timeSlotPayload = {
						timeslotIds: [...new Set(arg.timeslotIds)],
						token: this.token,
						apiHost: this.apiHost,
						tenantId,
						organizationId
					};

					const notification = {
						message: 'Idle time successfully deleted',
						title: this._environment.DESCRIPTION
					};

					const isReadyForDeletion = !this._isOffline && timeSlotPayload.timeslotIds.length > 0;

					if (isReadyForDeletion) {
						const apiParams = {
							token: this.token,
							note: this.note,
							projectId: this.projectSelect,
							taskId: this.taskSelect,
							organizationId,
							tenantId,
							organizationContactId: this.organizationContactId,
							apiHost: this.apiHost
						};

						let timeLog = null;

						if (arg.isWorking) {
							if (this.start) {
								await this.timeTrackerService.toggleApiStop({
									...apiParams,
									...arg.timer,
									stoppedAt: new Date()
								});
							}

							const isDeleted = await this.timeTrackerService.deleteTimeSlots(timeSlotPayload);

							if (isDeleted) {
								console.log('SUCCESS: Deleted');
							} else {
								console.warn('WARN: Unexpected error appears.');
							}

							timeLog = await this.timeTrackerService.toggleApiStart({
								...apiParams,
								startedAt: new Date()
							});

							await this.getTodayTime({ ...timeSlotPayload, employeeId }, true);
						} else {
							const timer = await this.electronService.ipcRenderer.invoke('STOP_TIMER', {
								quitApp: this.quitApp
							});

							timeLog = await this.timeTrackerService.toggleApiStop({
								...apiParams,
								...timer,
								stoppedAt: new Date()
							});

							const isDeleted = await this.timeTrackerService.deleteTimeSlots(timeSlotPayload);

							if (isDeleted) {
								console.log('SUCCESS: Deleted');
							} else {
								console.warn('WARN: Unexpected error appears.');
							}
						}

						asapScheduler.schedule(async () => {
							event.sender.send('update_session', { ...timeLog });

							try {
								const timeSlotId = arg.timer?.timeslotId;

								await this.electronService.ipcRenderer.invoke('UPDATE_SYNCED_TIMER', {
									lastTimer: timeLog,
									...arg.timer,
									...(timeSlotId && { timeSlotId })
								});
							} catch (error) {
								this._errorHandlerService.handleError(error);
							}
						});
					}

					if (this._isOffline || isReadyForDeletion) {
						this.refreshTimer();
						this._toastrNotifier.success(notification.message);
						this._nativeNotifier.success(notification.message);
					}
				} catch (error) {
					this._errorHandlerService.handleError(error);
				}
			});
		});

		this.electronService.ipcRenderer.on('update_view', (event, arg) => {
			this._ngZone.run(async () => {
				const idle = arg?.idleDuration ?? 0;
				this._lastTotalWorkedToday$.next(this._lastTotalWorkedToday - idle);
				this._lastTotalWorkedWeek$.next(this._lastTotalWorkedWeek - idle);

				await this.electronService.ipcRenderer.invoke('UPDATE_SYNCED_TIMER', {
					...arg?.timer,
					startedAt: arg?.stoppedAt
				});

				if (this.start) {
					event.sender.send('update_session', arg);
				}
			});
		});

		this.electronService.ipcRenderer.on('auth_success_tray_init', (event, arg) => {
			this._ngZone.run(() => {
				if (!this._isReady) {
					this.electronService.ipcRenderer.send('time_tracker_ready');
				}
			});
		});

		this.electronService.ipcRenderer.on('emergency_stop', (event, arg) => {
			this._ngZone.run(async () => {
				console.log('Emergency stop');

				if (this.start) {
					console.log('Emergency stop timer');
					await this.stopTimer(!this.isRemoteTimer, true);
				}
			});
		});

		this.electronService.ipcRenderer.on('clear_store', (event, arg) => {
			this._ngZone.run(async () => {
				await this.getTimerStatus(this.argFromMain);
				this._store.clear();
				localStorage.clear();
				event.sender.send('remove_current_user');
			});
		});

		this.electronService.ipcRenderer.on('interrupted-sequences', (event, args: ISequence[]) =>
			this._ngZone.run(async () => {
				if (this._isLockSyncProcess || this.isRemoteTimer) {
					this._inQueue$.next({
						...this.inQueue,
						inProgress: false
					});
					return;
				} else {
					this._isLockSyncProcess = true;
				}
				this._inQueue$.next({
					...this.inQueue,
					inProgress: true
				});
				console.log('🛠 - Preprocessing sequence');
				const sequenceQueue = new InterruptedSequenceQueue(
					this.electronService,
					this._errorHandlerService,
					this._store,
					this._timeSlotQueueService,
					this.timeTrackerService,
					this._timeTrackerStatus
				);
				console.log('⌗', args);
				for (const arg of args) sequenceQueue.enqueue(arg);
				args = []; // empty the array
				console.log('🚀 - Begin processing interrupted sequence queue');
				await sequenceQueue.process();
				console.log('🚨 - End processing interrupted sequence queue');
				asapScheduler.schedule(async () => {
					try {
						await this.electronService.ipcRenderer.invoke('FINISH_SYNCED_TIMER');
						this._isLockSyncProcess = false;
						if (!this.start) {
							this.refreshTimer();
						}
						console.log('✅ - Finish synced');
						if (this.inQueue.size > 0) {
							this.electronService.ipcRenderer.send('check-waiting-sequences');
						}
					} catch (error) {
						this._errorHandlerService.handleError(error);
					}
				});
			})
		);

		this._languageElectronService.initialize(asyncScheduler.schedule(() => this._loadSmartTableSettings(), 150));

		this.electronService.ipcRenderer.on('sleep_remote_lock', (event, state: boolean) => {
			this._ngZone.run(async () => {
				of(state)
					.pipe(
						distinctUntilChange(),
						tap((isPaused: boolean) => (this._remoteSleepLock = isPaused)),
						filter((isPaused: boolean) => !!isPaused && this.start),
						concatMap(() => this.toggleStart(false, false)),
						untilDestroyed(this)
					)
					.subscribe();
			});
		});

		this.electronService.ipcRenderer.on('ready_to_show_renderer', (event, arg) => {
			this._ngZone.run(() => {
				if (!this._isReady) {
					this.electronService.ipcRenderer.send('time_tracker_ready');
				}
			});
		});
	}

	/*
		Start/Stop Timer
		if val is true, we start the timer
		if val is false, we stop the timer
	 */
	async toggleStart(val, onClick = true) {
		// check that user is authorized to track time. If not, we return.
		if (val && !this.start && !this._passedAllAuthorizations()) return;

		if (this.isProcessingEnabled) {
			const message = val
				? 'Please wait some time for timer to stop and make final screenshot'
				: 'Please wait for timer to start and make initial screenshot';
			this._toastrNotifier.warn(message);
			this._loggerService.debug(message);
		} else {
			this.isProcessingEnabled = true;
		}

		this.loading = true;

		if (!val) {
			console.log('Stop tracking');

			await this.stopTimer(onClick);

			this.refreshTimer();

			this.loading = false;

			return;
		} else {
			console.log('Start tracking');

			// check that required inputs are set before we can start timer
			if (this.validationField()) {
				console.log('Validation passed');

				if (!this.start) {
					console.log('Starting timer');
					await this.startTimer(onClick);
				} else {
					console.log('Timer is already running');
					this.loading = false;
					this.isProcessingEnabled = false;
				}

				this.refreshTimer();
			} else {
				this.loading = false;
				this.isProcessingEnabled = false;
				this._loggerService.error('Error', 'validation failed');
			}
		}
	}

	async setTime({ second }) {
		if (second < this._lastTime) this._lastTime = 0;
		const dt = second - this._lastTime;
		this._lastTotalWorkedToday$.next(this._lastTotalWorkedToday + dt);
		this._lastTotalWorkedWeek$.next(this._lastTotalWorkedWeek + dt);
		this._lastTime = second;
		this._timeRun$.next(moment.duration(second, 'seconds').format('hh:mm:ss', { trim: false }));
		if (second % 5 === 0) {
			await this._activityWatchViewService.pingActivityWatchServer();
			if (this.lastScreenCapture.createdAt) {
				this.lastScreenCapture$.next({
					...this.lastScreenCapture,
					textTime: moment(this.lastScreenCapture.createdAt).fromNow()
				});
			}
		}
		await this.resetAtMidnight();
	}

	public async startTimer(onClick = true): Promise<void> {
		try {
			this.loading = true;

			if (onClick) {
				await this.getTodayTime(this.argFromMain);
				this._startMode = TimerStartMode.MANUAL;
			} else {
				this._startMode = TimerStartMode.REMOTE;
			}

			try {
				this.electronService.ipcRenderer.send('update_tray_start');
			} catch (error) {
				console.log('Error in update_tray_start', error);
			}

			const timer = await this.electronService.ipcRenderer.invoke('START_TIMER', {
				projectId: this.projectSelect,
				taskId: this.taskSelect,
				note: this.note,
				organizationContactId: this.organizationContactId,
				aw: {
					host: this._environment?.AWHost,
					isAw: this._activityWatchViewService.aw
				},
				timeLog: null,
				isRemoteTimer: this.isRemoteTimer,
				organizationTeamId: this.teamSelect
			});

			this.start$.next(true);

			this.loading = false;

			// update counter
			if (this.isRemoteTimer) {
				try {
					this.electronService.ipcRenderer.send('update_session', {
						startedAt: this._timeTrackerStatus.remoteTimer.startedAt
					});
				} catch (error) {
					console.log('Error in update_session', error);
				}
			}

			await this._toggle(timer, onClick);

			if (this._startMode === TimerStartMode.MANUAL) {
				console.log('Taking screen capture in startTimer');

				const activities = await this.electronService.ipcRenderer.invoke('TAKE_SCREEN_CAPTURE', {
					quitApp: this.quitApp
				});

				console.log('Sending activities');

				await this.sendActivities(activities);
			}

			console.log('Updating Task Status');
			await this.updateTaskStatus();

			console.log('Updating Organization Team Employee');
			await this.updateOrganizationTeamEmployee();

			this.electronService.ipcRenderer.send('request_permission');

			this.electronService.ipcRenderer.send('start-capture-screen');
		} catch (error) {
			this._startMode = TimerStartMode.STOP;
			this.start$.next(false);
			this._errorHandlerService.handleError(error);
		} finally {
			this.loading = false;
			this.isProcessingEnabled = false;
		}
	}

	public async stopTimer(onClick = true, isEmergency = false): Promise<void> {
		try {
			this.loading = true;

			const config = { quitApp: this.quitApp, isEmergency };

			this.electronService.ipcRenderer.send('stop-capture-screen');

			if (this._startMode === TimerStartMode.MANUAL) {
				console.log('Stopping timer');
				const timer = await this.electronService.ipcRenderer.invoke('STOP_TIMER', config);

				this.start$.next(false);

				this.loading = false;

				console.log('Toggling timer');
				await this._toggle(timer, onClick);

				asyncScheduler.schedule(async () => {
					console.log('Taking screen capture');
					const activities = await this.electronService.ipcRenderer.invoke('TAKE_SCREEN_CAPTURE', config);

					console.log('Sending activities');
					await this.sendActivities(activities);
				}, 1000);
			} else {
				console.log('Stopping timer');
				const timer = await this.electronService.ipcRenderer.invoke('STOP_TIMER', config);

				this.start$.next(false);

				this.loading = false;

				console.log('Toggling timer');
				await this._toggle(timer, onClick);
			}

			console.log('Updating Tray stop');

			this.electronService.ipcRenderer.send('update_tray_stop');

			this._startMode = TimerStartMode.STOP;

			if (this._isSpecialLogout) {
				// wait 3 sec and logout
				await this.logout();
			}

			if (this.quitApp) {
				console.log('Quitting app from stopTimer after 3 seconds delay');
				asyncScheduler.schedule(() => {
					this.electronService.remote.app.quit();
				}, 3000);
			}
		} catch (error) {
			console.log('[ERROR_STOP_TIMER]', error);
		} finally {
			this.loading = false;
			this.isProcessingEnabled = false;
		}
	}

	async getTask(arg) {
		try {
			const tasks = await this.timeTrackerService.getTasks(arg);
			if (tasks.length) {
				const statistics = await this.timeTrackerService.getTasksStatistics({
					...arg,
					taskIds: tasks.map((task) => task.id)
				});
				this._tasks$.next(this.merge(tasks, statistics));
				if (!this._tasks$.getValue().some((task) => task.id === this.taskSelect)) {
					this.taskSelect = null;
				}
			} else {
				this._tasks$.next([]);
			}
		} catch (error) {
			this._tasks$.next([]);
			console.log('ERROR', error);
		}
	}

	async getProjects(arg) {
		try {
			const projects = await this.timeTrackerService.getProjects(arg);

			// Check if the selected project is not in the response
			if (projects && !projects.some((project) => project.id === this.projectSelect)) {
				this.projectSelect = null;
				this.argFromMain.projectId = null;
			}

			// Update the projects observable with the response (or an empty array if it's falsy)
			this._projects$.next(projects || []);
		} catch (error) {
			// Handle errors by logging them and updating the projects observable with an empty array
			this._loggerService.error('ERROR', error);
			this._projects$.next([]);
		}
	}

	async getClient(arg) {
		try {
			const res = await this.timeTrackerService.getClient(arg);
			this._organizationContacts$.next(res || []);
		} catch (error) {
			this._organizationContacts$.next([]);
			console.log('ERROR', error);
		}
	}

	/*
	 * Get last running/completed timer status
	 * Get last running/completed timer status
	 * Get last running/completed timer status
	 */
	async getTimerStatus(arg) {
		if (this._isOffline || !arg?.organizationId || !arg?.tenantId) return;
		try {
			this.timerStatus = await this.timeTrackerService.getTimerStatus(arg);
			console.log('Get Last Timer Status:', this.timerStatus);
		} catch (error) {
			console.log('ERROR', error);
		}
	}

	async setClient(item, dialog) {
		if (this.start) {
			this.open(dialog, {
				type: this.dialogType.changeClient.name,
				val: item
			});
		} else {
			try {
				await this.selectClient(item);
			} catch (error) {
				console.log('ERROR', error);
			}
		}
	}

	public async selectClient(item: string): Promise<void> {
		this.organizationContactId = item;
		this.argFromMain.organizationContactId = item;
		this.electronService.ipcRenderer.send('update_project_on', {
			organizationContactId: this.organizationContactId
		});
		if (item) {
			await this.getProjects({
				...this.argFromMain,
				organizationContactId: this.organizationContactId
			});
			this._tasks$.next([]);
			this.teamSelect = null;
			this.errors.client = false;
		} else {
			await this.getProjects(this.argFromMain);
		}
	}

	public async setProject(item: string): Promise<void> {
		try {
			const parallelizedTasks: Promise<void>[] = [
				this.getTeams({
					...this.argFromMain,
					projectId: item
				}),
				this.getTask({
					...this.argFromMain,
					projectId: item
				})
			];
			this.projectSelect = item;
			this.argFromMain.projectId = item;
			this.electronService.ipcRenderer.send('update_project_on', {
				projectId: this.projectSelect
			});
			if (item) {
				this.errors.project = false;
			} else {
				this.errorBind();
			}
			await Promise.allSettled(parallelizedTasks);
		} catch (error) {
			console.log('ERROR', error);
		}
	}

	public setTask(item: string): void {
		this.taskSelect = item;
		this.electronService.ipcRenderer.send('update_project_on', {
			taskId: this.taskSelect
		});
		if (item) this.errors.task = false;
	}

	public descriptionChange(e): void {
		if (e) this.errors.note = false;
		this.clearSelectedTaskAndRefresh();
		this._clearItem();
		this.electronService.ipcRenderer.send('update_project_on', {
			note: this.note
		});
	}

	public validationField(): boolean {
		this.errorBind();
		const errors = [];
		const requireField = {
			task: 'requireTask',
			project: 'requireProject',
			client: 'requireClient',
			note: 'requireDescription'
		};
		Object.keys(this.errors).forEach((key) => {
			if (this.errors[key] && this.userOrganization[requireField[key]]) errors.push(true);
		});
		return errors.length === 0;
	}

	public errorBind(): void {
		if (!this.projectSelect && this.userOrganization.requireProject) this.errors.project = true;
		if (!this.taskSelect && this.userOrganization.requireTask) this.errors.task = true;
		if (!this.organizationContactId && this.userOrganization.requireClient) this.errors.client = true;
		if (!this.note && this.userOrganization.requireDescription) this.errors.note = true;
	}

	public doShoot(): void {
		this.electronService.ipcRenderer.send('screen_shoot');
	}

	public determineScreenshot(screenSize): { width: number; height: number } {
		const maxDimension = Math.max(screenSize.width, screenSize.height);
		console.log(maxDimension);

		return {
			width: Math.floor(maxDimension * window.devicePixelRatio),
			height: Math.floor(maxDimension * window.devicePixelRatio)
		};
	}

	public async getTodayTime(arg, isForcedSync?: boolean): Promise<void> {
		if (this._isOffline) return;
		try {
			const res = await this.timeTrackerService.getTimeLogs(arg);
			if (res) {
				this.countDuration(res, isForcedSync);
			}
		} catch (error) {
			console.log('ERROR', error);
		}
	}

	public async getLastTimeSlotImage(arg): Promise<void> {
		if (this._isOffline) return;
		try {
			const res = await this.timeTrackerService.getTimeSlot(arg);
			let { screenshots }: any = res;
			console.log('Get Last Timeslot Image Response:', screenshots);
			if (screenshots && screenshots.length > 0) {
				screenshots = _.sortBy(screenshots, 'recordedAt').reverse();
				const [lastCaptureScreen] = screenshots;
				console.log('Last Capture Screen:', lastCaptureScreen);
				this.lastScreenCapture$.next(lastCaptureScreen);
				await this.localImage(this.lastScreenCapture);
				this.screenshots$.next(screenshots);
				this.lastTimeSlot = res;
			}
			if (this.lastScreenCapture.recordedAt) {
				this.lastScreenCapture$.next({
					...this.lastScreenCapture,
					textTime: moment(this.lastScreenCapture.recordedAt).fromNow()
				});
			} else {
				this.updateImageUrl();
			}
		} catch (error) {
			this._errorHandlerService.handleError(error);
		}
	}

	public async localImage(img, originalBase64Image?: string): Promise<void> {
		try {
			const convScreenshot =
				img && img.thumbUrl ? await this._imageViewerService.getBase64ImageFromUrl(img.thumbUrl) : img;
			localStorage.setItem(
				'lastScreenCapture',
				JSON.stringify({
					thumbUrl: convScreenshot,
					textTime: moment().fromNow(),
					createdAt: Date.now(),
					recordedAt: Date.now(),
					...(originalBase64Image && {
						fullUrl: originalBase64Image
					})
				})
			);
		} catch (error) {
			console.log('ERROR', error);
		}
	}

	public updateImageUrl(e?: string): void {
		let localLastScreenCapture: any = localStorage.getItem('lastScreenCapture');
		if (localLastScreenCapture) {
			localLastScreenCapture = JSON.parse(localLastScreenCapture);
			this.lastScreenCapture$.next({
				...localLastScreenCapture
			});
		}
		if (e) {
			console.log('image error', e);
			this.lastScreenCapture$.next({});
		}
	}

	public async setTimerDetails(): Promise<void> {
		try {
			const res: any = await this.timeTrackerService.getUserDetail();
			if (res.employee && res.employee.organization) {
				this.userData = res;
				if (res.role && res.role.rolePermissions) {
					this._store.userRolePermissions = res.role.rolePermissions;
					this.userPermission = res.role.rolePermissions
						.map((permission) => (permission.enabled ? permission.permission : null))
						.filter((permission) => !!permission);
					this._permissions$.next(this.userPermission);
				}
				if (res.employee.reWeeklyLimit) {
					this._weeklyLimit$.next(res.employee.reWeeklyLimit);
				}
				this.userOrganization$.next(res.employee.organization);
				let isAllowScreenCapture = true;
				const employee = res.employee;
				if ('allowScreenshotCapture' in employee || 'allowScreenshotCapture' in employee.organization) {
					isAllowScreenCapture =
						employee.allowScreenshotCapture === true &&
						employee.organization.allowScreenshotCapture === true;
				}
				this.electronService.ipcRenderer.send('update_timer_auth_config', {
					activityProofDuration: res.employee.organization.activityProofDuration,
					inactivityTimeLimit: res.employee.organization.inactivityTimeLimit,
					allowTrackInactivity: res.employee.organization.allowTrackInactivity,
					isRemoveIdleTime: res.employee.organization.isRemoveIdleTime,
					allowScreenshotCapture: isAllowScreenCapture
				});
				const enforced = res.employee.organization.enforced;
				const settings = {
					timer: { updatePeriod: res.employee.organization.screenshotFrequency },
					trackOnPcSleep: res.employee.organization.trackOnSleep,
					randomScreenshotTime: res.employee.organization.randomScreenshot
				};
				this.electronService.ipcRenderer.send('update_app_setting', {
					values: {
						enforced,
						...(enforced && settings)
					}
				});
				this.isTrackingEnabled =
					typeof res.employee.isTrackingEnabled !== 'undefined' ? res.employee.isTrackingEnabled : true;
				this.electronService.ipcRenderer.send(this.isTrackingEnabled ? 'show_ao' : 'hide_ao');
			}
		} catch (error) {
			console.log('[User Error]: ', error);
		}
	}

	public showImage(): void {
		this.electronService.ipcRenderer.send('show_image', this.screenshots);
	}

	public open(dialog: TemplateRef<any>, option): void {
		try {
			this.selectedTimeSlot = this.lastTimeSlot;
			this._dialog = this.dialogService.open(dialog, {
				context: this.dialogType[option.type].message,
				backdropClass: 'backdrop-blur'
			});
			this._dialog.onClose.subscribe(async (selectedOption) => {
				if (selectedOption) {
					switch (option.type) {
						case this.dialogType.changeClient.name:
							await this.selectClient(option.val);
							break;
						case this.dialogType.deleteLog.name:
							await this.deleteTimeSlot();
							break;
						case this.dialogType.timeTrackingOption.name:
							this._isOpenDialog = false;
							await this.toggleStart(true);
							break;
						default:
							break;
					}
				} else if (this.start && option.type === this.dialogType.timeTrackingOption.name) {
					this._isOpenDialog = false;
					await this.stopTimer();
				}
			});
		} catch (error) {
			console.log('ERROR', error);
		}
	}

	async deleteTimeSlot(): Promise<void> {
		this._isOffline
			? await this.electronService.ipcRenderer.invoke('DELETE_TIME_SLOT', this.screenshots[0].id)
			: await this._deleteSyncedTimeslot();
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

	public openSetting(): void {
		this.electronService.ipcRenderer.send('open_setting_window');
	}

	public expand(): void {
		this.isCollapse$.next(this.isExpand);
		this.electronService.ipcRenderer.send('expand', !this.isExpand);
	}

	public handleRowSelection(selectionEvent): void {
		if (this.isNoRowSelected(selectionEvent)) {
			this.clearSelectedTaskAndRefresh();
		} else {
			const selectedRow = selectionEvent.selected[0];
			this.handleSelectedTaskChange(selectedRow.id);
		}
	}

	private isNoRowSelected(selectionEvent): boolean {
		return !selectionEvent.selected.length;
	}

	private clearSelectedTaskAndRefresh(): void {
		this.setTask(null);
	}

	private handleSelectedTaskChange(selectedTaskId): void {
		if (this.isDifferentTask(selectedTaskId)) {
			this.setTask(selectedTaskId);
		}
	}

	private isDifferentTask(selectedTaskId): boolean {
		return this.taskSelect !== selectedTaskId;
	}

	public onSearch(query: string = ''): void {
		if (query) {
			this._sourceData.setFilter(
				[
					{
						field: 'title',
						search: query
					},
					{
						field: 'taskNumber',
						search: query
					}
				],
				false
			);
		} else {
			this._sourceData.reset();
			this._sourceData.refresh();
		}
	}

	public async getScreenshot(arg, isThumb: boolean | null = false): Promise<any> {
		try {
			let thumbSize = this.determineScreenshot(arg.screenSize);

			if (isThumb)
				thumbSize = {
					width: 320,
					height: 240
				};

			const sources = await this.electronService.desktopCapturer.getSources({
				types: ['screen'],
				thumbnailSize: thumbSize
			});

			const screens = [];

			sources.forEach((source) => {
				this._loggerService.info('screenshot_res::', JSON.stringify(source));
				if (
					this.appSetting &&
					this.appSetting.monitor &&
					this.appSetting.monitor.captured &&
					this.appSetting.monitor.captured === 'active-only'
				) {
					if (arg.activeWindow && source.display_id === arg.activeWindow.id.toString()) {
						screens.push({
							img: source.thumbnail.toPNG(),
							name: source.name,
							id: source.display_id
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

			this._loggerService.info('screenshot data::', JSON.stringify(screens));

			return screens;
		} catch (error) {
			this._errorHandlerService.handleError(error);
			return [];
		}
	}

	public async sendActivities(arg): Promise<void> {
		console.log('sendActivities');

		if (this.isRemoteTimer) {
			console.log('isRemoteTimer exit from sendActivities');
			return;
		}

		// screenshot process
		let screenshotImg = [];

		let thumbScreenshotImg = [];

		try {
			if (!arg.displays) {
				screenshotImg = await this.getScreenshot(arg, false);
				thumbScreenshotImg = await this.getScreenshot(arg, true);
			} else {
				screenshotImg = arg.displays;
			}

			// notify
			this.screenshotNotify(arg, thumbScreenshotImg);
		} catch (error) {
			this._loggerService.error('Error on screenshot', error);
		}

		const paramActivity = {
			employeeId: arg.employeeId,
			projectId: arg.projectId,
			duration: arg.duration,
			keyboard: arg.keyboard,
			mouse: arg.mouse,
			overall: arg.system,
			startedAt: arg.startedAt,
			activities: arg.activities,
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
			const resActivities: any = await this.timeTrackerService.pushToTimeSlot(paramActivity);

			console.log('Result of TimeSlot', resActivities);

			const timeLogs = resActivities.timeLogs;

			if (!timeLogs?.length) {
				// Stop process if there is no time logs associate to activity result.
				this._loggerService.error('[@SendActivities]', 'No time logs');
				return;
			}

			this.electronService.ipcRenderer.send('return_time_slot', {
				timerId: arg.timerId,
				timeSlotId: resActivities.id,
				quitApp: arg.quitApp,
				timeLogs: timeLogs
			});

			this.electronService.ipcRenderer.send('remove_aw_local_data');

			this.electronService.ipcRenderer.send('remove_wakatime_local_data', {
				idsWakatime: arg.idsWakatime
			});

			if (!this._isOffline && screenshotImg.length > 0) {
				/* Converting the screenshot image to a base64 string. */
				const original = `data:image/png;base64, ${this.buffToB64(screenshotImg[0])}`;

				/* Compressing the image to 320x200 */
				const compressed = await compressImage(original, 320, 200);

				/*  Saving compressed image to the local storage. */
				await this.localImage(compressed, original);

				/* Update image waiting for server response*/
				this.updateImageUrl(null);

				/* Adding the last screen capture to the screenshots array. */
				this.screenshots$.next([...this.screenshots, this.lastScreenCapture]);
			}

			// upload screenshot to TimeSlot api
			try {
				await Promise.all(
					screenshotImg.map(async (img) => {
						return await this.uploadsScreenshot(arg, img, resActivities.id);
					})
				);
			} catch (error) {
				console.log('ERROR', error);
			}

			const timeSlotId = resActivities.id;

			console.log('Get last time slot image');
			await this.getLastTimeSlotImage({
				...arg,
				token: this.token,
				apiHost: this.apiHost,
				timeSlotId
			});

			console.log('Sending create-synced-interval event...');
			this.electronService.ipcRenderer.send('create-synced-interval', {
				...paramActivity,
				remoteId: timeSlotId,
				b64Imgs: []
			});
		} catch (error) {
			this._loggerService.error('Error send to api timeslot::', error);
			try {
				console.log('Sending failed_synced_timeslot event...');
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
				});
			} catch (e) {
				this._loggerService.error('Failed to send failed_synced_timeslot event', e);
			}
		}
	}

	public screenshotNotify(arg, imgs: any[]): void {
		if (imgs.length > 0) {
			const img: any = imgs[0];
			img.img = this.buffToB64(img);
			this.electronService.ipcRenderer.send('show_screenshot_notif_window', img);
		}
	}

	public async uploadsScreenshot(arg, imgs: any[], timeSlotId: string): Promise<Object> {
		const b64img = this.buffToB64(imgs);
		const fileName = this.fileNameFormat(imgs);
		try {
			const resImg = await this.timeTrackerService.uploadImages(
				{ ...arg, timeSlotId },
				{
					b64Img: b64img,
					fileName: fileName
				}
			);
			return resImg;
		} catch (error) {
			this._loggerService.error(error);
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
		const bufferImg: Buffer = Buffer.isBuffer(imgs.img) ? imgs.img : Buffer.from(imgs.img);
		const b64img = bufferImg.toString('base64');
		return b64img;
	}

	fileNameFormat(imgs) {
		const fileName = `screenshot-${moment().format('YYYYMMDDHHmmss')}-${imgs.name}.png`;
		return this.convertToSlug(fileName);
	}

	public refreshTimer(): void {
		console.log('refresh timer');
		this.loading = true;
		try {
			this._isRefresh$.next(true);
			this.electronService.ipcRenderer.send('refresh-timer');
		} catch (err) {
			console.log('Error', err);
		} finally {
			this.loading = false;
		}
	}

	public checkOnlineStatus(): boolean {
		if (navigator.onLine) {
			return true;
		} else {
			return false;
		}
	}

	public addTask(): void {
		this.isAddTask = !this._isOffline && this._hasTaskPermission;
		if (!this.isAddTask) {
			return;
		}
		this.dialogService
			.open(TasksComponent, {
				context: {
					employee: this.userData,
					hasProjectPermission: this.hasProjectPermission$.getValue(),
					selected: {
						projectId: this.projectSelect,
						teamId: this.teamSelect,
						contactId: this.organizationContactId
					},
					userData: this.argFromMain
				},
				backdropClass: 'backdrop-blur'
			})
			.onClose.pipe(
				tap(() => this.closeAddTask()),
				filter((result) => !!result),
				tap((result) => this.callbackNewTask(result)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public closeAddTask(): void {
		this.isAddTask = false;
		this.electronService.ipcRenderer.send('refresh-timer');
	}

	public callbackNewTask(e): void {
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

	public showErrorMessage(msg): void {
		this.toastrService.show(`${msg}`, `Warning`, {
			status: 'danger'
		});
	}

	public toggle(event: boolean) {
		this._isOffline$.next(this._isOffline);
	}

	/**
	 * It takes a date and returns a string
	 * @param {Date} date - The date to humanize
	 * @returns A string
	 */

	public humanize(date: Date): string {
		return moment(date).fromNow();
	}

	/* Adding a new project to the list of projects. */
	public addProject = async (name: string) => {
		try {
			const { tenantId } = this._store;
			const organizationId = this._store.organizationId;
			const request = {
				name,
				organizationId,
				tenantId,
				owner: ProjectOwnerEnum.CLIENT,
				...(this.organizationContactId ? { organizationContactId: this.organizationContactId } : {})
			};

			request['members'] = [{ ...this.userData.employee }];

			console.log('Request', request);
			const project = await this.timeTrackerService.createNewProject(request, {
				...this.userData,
				token: this.token,
				apiHost: this.apiHost
			});
			const projects = this._projects$.getValue();
			this._projects$.next(projects.concat([project]));
			this.projectSelect = project.id;
			this._toastrNotifier.success(this._translateService.instant('TIMER_TRACKER.TOASTR.PROJECT_ADDED'));
		} catch (error) {
			console.log(error);
		}
	};

	/* Adding a new task to the list of tasks. */
	public addNewTask = async (title: ITask['title']) => {
		if (!title) {
			return;
		}
		const { tenantId, organizationId } = this._store;
		const data = {
			tenantId,
			organizationId,
			token: this.token,
			apiHost: this.apiHost,
			projectId: this.projectSelect
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
					project: this.selectedProject
				})
			});
			const tasks = this._tasks$.getValue();
			this._tasks$.next(tasks.concat(task));
			this.taskSelect = task.id;
			this._toastrNotifier.success(this._translateService.instant('TIMER_TRACKER.TOASTR.TASK_ADDED'));
		} catch (error) {
			console.log('ERROR', error);
		}
	};

	/* Creating a new contact for the organization. */
	public addContact = async (name: IOrganizationContact['name']) => {
		try {
			const { tenantId, organizationId } = this._store;
			const member: any = { ...this.userData.employee };
			const payload = {
				name,
				organizationId,
				tenantId,
				contactType: ContactType.CLIENT,
				...(member.id && { members: [member] })
			};
			const contact = await this.timeTrackerService.createNewContact(payload, {
				...this.userData,
				token: this.token,
				apiHost: this.apiHost
			});
			const contacts = this._organizationContacts$.getValue();
			this._organizationContacts$.next(contacts.concat([contact]));
			this.organizationContactId = contact.id;
			this._toastrNotifier.success(this._translateService.instant('TIMER_TRACKER.TOASTR.CLIENT_ADDED'));
		} catch (error) {
			console.log('ERROR', error);
		}
	};

	public selectOrganization(organization: IOrganization) {
		console.log('Organization', organization);
	}

	public noLimit(value: number): boolean {
		return value === Infinity;
	}

	public async logout() {
		// we wait 3 sec and then logout
		asyncScheduler.schedule(async () => {
			await firstValueFrom(this._authStrategy.logout());
			this._isSpecialLogout = false;
			this.electronService.ipcRenderer.send(
				this._isRestartAndUpdate ? 'restart_and_update' : 'navigate_to_login'
			);
			localStorage.clear();
		}, 3000);
	}

	public async restart(): Promise<void> {
		// if timer's running as viewer we no need to restart
		if (this.isRemoteTimer) {
			return;
		}

		// wait 3 sec and then restart
		asyncScheduler.schedule(async () => {
			try {
				// lock restart process
				this._isLockSyncProcess = true;
				// resolve promise and add debounce time to avoid riding
				await lastValueFrom(
					from(this.toggleStart(false)).pipe(
						debounceTime(200),
						concatMap(() => this.toggleStart(true)),
						untilDestroyed(this)
					)
				);
			} catch (error) {
				// force stop timer
				try {
					await this.stopTimer(false, true);
				} catch (e) {
					this._loggerService.error('Error in force stop timer', e);
				}
			} finally {
				// unlock restart process
				this._isLockSyncProcess = false;
			}
		}, 3000);
	}

	public async updateOrganizationTeamEmployee(): Promise<void> {
		try {
			if (!this.taskSelect || !this.teamSelect) {
				return;
			}
			const organizationTeamId = this.teamSelect;
			const { tenantId, organizationId } = this._store;
			const { employeeId } = this._store.user;
			const activeTaskId = this.taskSelect;
			const payload = {
				activeTaskId,
				tenantId,
				organizationId,
				organizationTeamId
			};
			await this.timeTrackerService.updateOrganizationTeamEmployee(employeeId, payload);
		} catch (error) {
			this._loggerService.error(error);
		}
	}

	public async getTeams(arg?: any): Promise<void> {
		try {
			const teams = await this.timeTrackerService.getTeams(arg);
			// Check if the selected team is not in the response
			if (!teams.some((team) => team.id === this.teamSelect)) {
				this.teamSelect = null;
				this.argFromMain.organizationTeamId = null;
			}
			this._teams$.next(teams);
		} catch (error) {
			this._teams$.next([]);
			this._errorHandlerService.handleError(error);
		}
	}

	public async setTeams(organizationTeamId: string): Promise<void> {
		try {
			const parallelizedTasks: Promise<void>[] = [
				this.getProjects({
					...this.argFromMain,
					organizationTeamId
				}),
				this.getTask({
					...this.argFromMain,
					organizationTeamId
				})
			];
			this.teamSelect = organizationTeamId;
			this.electronService.ipcRenderer.send('update_project_on', {
				organizationTeamId
			});
			this.argFromMain.organizationTeamId = organizationTeamId;
			if (organizationTeamId) {
				this.errors.teams = false;
			} else {
				this.errorBind();
			}
			await Promise.allSettled(parallelizedTasks);
		} catch (error) {
			this._loggerService.error('ERROR', error);
		}
	}

	private async updateTaskStatus() {
		try {
			const { tenantId, organizationId } = this._store;
			if (!this.taskSelect || this.selectedTask.status === TaskStatusEnum.IN_PROGRESS) {
				return;
			}
			const id = this.selectedTask.id;
			const title = this.selectedTask.title;
			const status = TaskStatusEnum.IN_PROGRESS;
			const taskStatus = this._store.statuses.find((taskStatus) => taskStatus.name === status);
			const taskUpdateInput: ITaskUpdateInput = {
				organizationId,
				tenantId,
				status,
				title,
				taskStatus
			};
			await this.timeTrackerService.updateTask(id, taskUpdateInput);
		} catch (error) {
			this._loggerService.error(error);
		}
	}

	public get processingStatus() {
		if (this._isSpecialLogout) {
			return { state: this._isSpecialLogout, message: 'Logout in progress' };
		}

		if (this.quitApp) {
			return { state: this.quitApp, message: 'Application is shutting down' };
		}

		return { state: false, message: '' };
	}
}
