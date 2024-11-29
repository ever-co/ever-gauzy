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
	IOrganization,
	IOrganizationTeam,
	ITask,
	ITaskUpdateInput,
	ITimeLog,
	ITimeSlotTimeLogs,
	PermissionsEnum,
	TaskStatusEnum
} from '@gauzy/contracts';
import { compressImage, distinctUntilChange } from '@gauzy/ui-core/common';
import { NbDialogRef, NbDialogService, NbIconLibraries, NbRouteTab, NbToastrService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import moment from 'moment';;
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
	Subscription,
	tap,
	timer
} from 'rxjs';
import { AlwaysOnService, AlwaysOnStateEnum } from '../always-on/always-on.service';
import { AuthStrategy } from '../auth';
import { BLOCK_DELAY, GAUZY_ENV } from '../constants';
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
import { ClientSelectorService } from '../shared/features/client-selector/+state/client-selector.service';
import { NoteService } from '../shared/features/note/+state/note.service';
import { ProjectSelectorService } from '../shared/features/project-selector/+state/project-selector.service';
import { TaskSelectorService } from '../shared/features/task-selector/+state/task-selector.service';
import { TeamSelectorService } from '../shared/features/team-selector/+state/team-selector.service';
import { TimeTrackerFormService } from '../shared/features/time-tracker-form/time-tracker-form.service';
import { hasAllPermissions } from '../shared/utils/permission.util';
import { SelectorValidator } from '../shared/utils/validation/selector.validator';
import { TimeTrackerQuery } from './+state/time-tracker.query';
import { IgnitionState, TimeTrackerStore } from './+state/time-tracker.store';
import { IRemoteTimer } from './time-tracker-status/interfaces';
import { TimeTrackerStatusService } from './time-tracker-status/time-tracker-status.service';
import { TimeTrackerService } from './time-tracker.service';
import { TimerTrackerChangeDialogComponent } from './timer-tracker-change-dialog/timer-tracker-change-dialog.component';

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
	private _session: moment.Moment = null;
	private hasActiveTaskPermissions = false;
	private timerSubscription: Subscription | null = null;
	@ViewChild('dialogOpenBtn') btnDialogOpen: ElementRef<HTMLElement>;
	public start$: BehaviorSubject<boolean> = new BehaviorSubject(false);
	userData: any;
	organization: any = {};
	errors: any = {};
	note: String = null;
	public todayDuration$: BehaviorSubject<any> = new BehaviorSubject('--h --m');
	public weeklyDuration$: BehaviorSubject<any> = new BehaviorSubject('--h --m');
	public userOrganization$: BehaviorSubject<any> = new BehaviorSubject({});
	public lastScreenCapture$: BehaviorSubject<any> = new BehaviorSubject({});
	public processing$ = new BehaviorSubject(this.processingStatus);
	userPermission: any = [];
	quitApp = false;
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
	sound: any = null;

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
		private readonly _languageElectronService: LanguageElectronService,
		private readonly clientSelectorService: ClientSelectorService,
		private readonly teamSelectorService: TeamSelectorService,
		private readonly projectSelectorService: ProjectSelectorService,
		private readonly taskSelectorService: TaskSelectorService,
		private readonly noteService: NoteService,
		private readonly timeTrackerQuery: TimeTrackerQuery,
		private readonly timeTrackerStore: TimeTrackerStore,
		private readonly timeTrackerFormService: TimeTrackerFormService
	) {
		this.iconLibraries.registerFontPack('font-awesome', {
			packClass: 'fas',
			iconClassPrefix: 'fa'
		});
		this._permissions$
			.pipe(
				filter((permissions: any[]) => permissions.length > 0),
				tap((permissions: any[]) => {
					this.taskSelectorService.hasPermission = hasAllPermissions(
						permissions,
						PermissionsEnum.ORG_TASK_ADD
					);
					this.clientSelectorService.hasPermission = hasAllPermissions(
						permissions,
						PermissionsEnum.ORG_CONTACT_EDIT
					);
					this.projectSelectorService.hasPermission = hasAllPermissions(
						permissions,
						PermissionsEnum.ORG_PROJECT_ADD
					);
					this.hasActiveTaskPermissions = hasAllPermissions(
						permissions,
						PermissionsEnum.ORG_TEAM_EDIT_ACTIVE_TASK,
						PermissionsEnum.ALL_ORG_EDIT
					);
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

	private get _isOffline(): boolean {
		return this._isOffline$.getValue();
	}

	private get _lastTotalWorkedToday(): number {
		return this._lastTotalWorkedToday$.getValue();
	}

	private get _lastTotalWorkedWeek(): number {
		return this._lastTotalWorkedWeek$.getValue();
	}

	public get selectedTeam(): IOrganizationTeam {
		return this.teamSelectorService.selected;
	}

	public get selectedTask(): ITask {
		return this.taskSelectorService.selected;
	}

	private _timeRun$: BehaviorSubject<string> = new BehaviorSubject('00:00:00');

	public get timeRun$(): Observable<string> {
		return this._timeRun$.asObservable();
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
			if (this.timerStatus.running && this.start) {
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
				await Promise.allSettled([this.getTodayTime(true), this.getLastTimeSlotImage({ timeSlotId })]);
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

			const remoteTimer = this._timeTrackerStatus.remoteTimer;
			const isRemoteTimerRunning = remoteTimer && remoteTimer.running;
			const isInRemoteStartMode = this._startMode === TimerStartMode.REMOTE;
			const isLocalTimerNotStarted = !isStarted;
			const isToggleModeValid = this.xor(isLocalTimerNotStarted, isRemoteTimerRunning);

			const isRemote = (isToggleModeValid && isInRemoteStartMode) || !onClick;

			const params = {
				token: this.token,
				note: this.noteService.note,
				projectId: this.projectSelectorService.selectedId,
				taskId: this.taskSelectorService.selectedId,
				organizationId: this._store.organizationId,
				tenantId: this._store.tenantId,
				organizationContactId: this.clientSelectorService.selectedId,
				apiHost: this.apiHost
			};

			let timelog = null;

			console.log('[TIMER_STATE]', lastTimer);

			if (isStarted) {
				if (!this._isOffline && !this._remoteSleepLock) {
					try {
						timelog = isRemote
							? this._timeTrackerStatus.remoteTimer.lastLog
							: await this.preventDuplicateApiRequest({ ...lastTimer, ...params }, (payload) =>
									this.timeTrackerService.toggleApiStart(payload)
							  );
					} catch (error) {
						lastTimer.isStartedOffline = true;
						this._loggerService.error(error);
					}
				}
			} else {
				if (!this._isOffline) {
					try {
						// Combine all conditions into a single descriptive boolean
						const isRetrieveRemoteLog =
							!isRemoteTimerRunning ||
							isRemote ||
							this._remoteSleepLock ||
							(this.isRemoteTimer && (this._isSpecialLogout || this.quitApp));

						if (isRetrieveRemoteLog) {
							// Retrieve remote timer log
							timelog = this._timeTrackerStatus.remoteTimer.lastLog;
						} else {
							// Create request parameters only when necessary
							const requestParams = {
								...params,
								...lastTimer
							};
							// Execute API request to stop timer and store the result in timelog
							timelog = await this.preventDuplicateApiRequest(requestParams, (payload) =>
								this.timeTrackerService.toggleApiStop(payload)
							);
						}
					} catch (error) {
						// Handle any error during the process
						lastTimer.isStoppedOffline = true;
						await this.electronService.ipcRenderer.invoke('MARK_AS_STOPPED_OFFLINE');
						this._loggerService.error(error);
					}
				}
			}

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

	private async loadStatuses(): Promise<void> {
		if (!this._store.organizationId && !this._store.tenantId) {
			return;
		}

		const { organizationId, tenantId } = this._store;

		this._store.statuses = await this.timeTrackerService.statuses({
			tenantId,
			organizationId,
			...(this.projectSelectorService.selectedId
				? {
						projectId: this.projectSelectorService.selectedId
				  }
				: {})
		});
	}

	ngOnInit(): void {
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
					this.timeTrackerStore.update({ isEditing: false });
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
						!!remoteTimer.lastLog &&
						this.xor(this.start, remoteTimer.running) &&
						!this._isLockSyncProcess &&
						this._isReady &&
						this.inQueue.size === 0
				),
				tap(async (remoteTimer: IRemoteTimer) => {
					this.timeTrackerFormService.setState({
						clientId: remoteTimer.lastLog.organizationContactId,
						teamId: remoteTimer.lastLog.organizationTeamId,
						projectId: remoteTimer.lastLog.projectId,
						note: remoteTimer.lastLog.description,
						taskId: remoteTimer.lastLog.taskId
					});
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

		this._isRefresh$
			.asObservable()
			.pipe(
				tap((isRefreshing) => this.timeTrackerStore.update({ isRefreshing })),
				untilDestroyed(this)
			)
			.subscribe();
		this.isExpand$
			.asObservable()
			.pipe(
				tap((isExpanded) => this.timeTrackerStore.update({ isExpanded })),
				untilDestroyed(this)
			)
			.subscribe();

		this.timeTrackerQuery.ignition$
			.pipe(
				filter(({ state }) => state === IgnitionState.RESTARTING),
				concatMap(async ({ data }) => {
					this.isProcessingEnabled = true;
					this.timeTrackerFormService.setState(data);
					const session: moment.Moment = this._session?.clone();
					const sessionLog = await this.silentRestart();
					return { sessionLog, session };
				}),
				tap(async ({ session, sessionLog }) => {
					if (sessionLog.previous) {
						const { current, previous, params } = sessionLog;
						const sessionStartedAt = moment(current.startedAt);
						const { stoppedAt, startedAt } = previous;

						// Calculate idle time since last stop
						const idle = sessionStartedAt.diff(moment(stoppedAt), 'seconds', true);
						console.log('[RESTART IDLE]', idle);

						if (session) {
							// Update the session start time by adding idle time
							this._session = session.add(idle, 'seconds');
						} else {
							// Initialize the session start time based on idle time
							this._session = moment(startedAt).add(idle, 'seconds');
						}

						this.isProcessingEnabled = false;

						asapScheduler.schedule(async () => {
							const lastTimer = {
								...current,
								startedAt: this._session.toISOString()
							};
							// Send updated session data via Electron IPC
							this.electronService.ipcRenderer.send('update_session', lastTimer);

							try {
								await this.electronService.ipcRenderer.invoke('UPDATE_SYNCED_TIMER', {
									lastTimer,
									...(params as any)
								});
							} catch (error) {
								this._errorHandlerService.handleError(error);
							}
						});
					}
					// Update store state directly after restarting
					this.timeTrackerStore.ignition({ state: IgnitionState.RESTARTED });
				}),
				untilDestroyed(this)
			)
			.subscribe();

		this.timeTrackerQuery.isEditing$
			.pipe(
				filter((editing) => editing && !this._isOffline),
				concatMap(
					() =>
						this.dialogService.open(TimerTrackerChangeDialogComponent, {
							backdropClass: 'backdrop-blur',
							closeOnBackdropClick: false
						}).onClose
				),
				filter(Boolean),
				tap((value) => this.timeTrackerFormService.setState(value)),
				untilDestroyed(this)
			)
			.subscribe();
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
				this.token = arg.token;
				this._activityWatchViewService.aw$.next(!!arg.aw?.isAw);
				this.appSetting$.next(arg.settings);
				this._timeZoneManager.changeZone(this.appSetting?.zone || ZoneEnum.LOCAL);
				if (!this._isReady && this.appSetting?.alwaysOn) {
					this.electronService.ipcRenderer.send('show_ao');
				}
				this.timeTrackerFormService.setState({
					clientId: arg.organizationContactId,
					teamId: arg.organizationTeamId,
					projectId: arg.projectId,
					taskId: arg.taskId,
					note: arg.note
				});
				const parallelizedTasks: Promise<void>[] = [
					this.loadStatuses(),
					this.clientSelectorService.load(),
					this.projectSelectorService.load(),
					this.teamSelectorService.load(),
					this.taskSelectorService.load(),
					this.getTodayTime(),
					this.setTimerDetails(),
					this.getLastTimeSlotImage(arg)
				];
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
					this.processing$.next(this.processingStatus);
				}

				// Check if quitApp flag is already set, and if so, force stop the timer and return
				if (this.quitApp) {
					await this.stopTimer(!this.isRemoteTimer, true);
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
				await this.getTodayTime();
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
				if (this.start) {
					await this.toggleStart(false);
				}
			})
		);

		this.electronService.ipcRenderer.on('activity-proof-request', () => {
			this._ngZone.run(() => {
				if (this.start) {
					this._dialog?.close();
					this._isOpenDialog = false;
				}
			});
		});

		this.electronService.ipcRenderer.on('stop_from_inactivity_handler', () => {
			this._ngZone.run(async () => {
				if (this.start) {
					await this.toggleStart(false);
				}
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
					this.processing$.next(this.processingStatus);
					await this.stopTimer();
				}
				if (!this._isSpecialLogout) {
					await this.logout();
				}
			})
		);

		this.electronService.ipcRenderer.on('prepare_activities_screenshot', (event, arg) =>
			this._ngZone.run(async () => {
				await this.takeCaptureAndSendActivities(arg);
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
				await this.getTodayTime();
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

					console.log('remove_idle_time', arg);

					const isReadyForDeletion = !this._isOffline && timeSlotPayload.timeslotIds.length > 0;

					if (isReadyForDeletion) {
						const apiParams = {
							...arg.timer,
							token: this.token,
							note: this.noteService.note,
							projectId: this.projectSelectorService.selectedId,
							taskId: this.taskSelectorService.selectedId,
							organizationContactId: this.clientSelectorService.selectedId,
							organizationTeamId: this.teamSelectorService.selectedId,
							organizationId,
							tenantId,
							apiHost: this.apiHost
						};

						this._isLockSyncProcess = true;

						if (arg.isWorking) {
							if (this.start) {
								await this.preventDuplicateApiRequest(
									{
										...apiParams,
										...arg.timer
									},
									(payload) => this.timeTrackerService.toggleApiStop(payload)
								);
							}

							const isDeleted = await this.timeTrackerService.deleteTimeSlots(timeSlotPayload);

							if (isDeleted) {
								console.log('SUCCESS: Deleted');
							} else {
								console.warn('WARN: Unexpected error appears.');
							}

							await this.preventDuplicateApiRequest(
								{
									...apiParams,
									startedAt: new Date()
								},
								(payload) => this.timeTrackerService.toggleApiStart(payload)
							);

							await this.getTodayTime(true);
						} else {
							if (this.start) {
								try {
									await this.electronService.ipcRenderer.invoke('STOP_TIMER', {
										quitApp: this.quitApp
									});
									this.start$.next(false);
									await this.preventDuplicateApiRequest(
										{
											...apiParams,
											...arg.timer
										},
										(payload) => this.timeTrackerService.toggleApiStop(payload)
									);
								} catch (error) {
									await this.electronService.ipcRenderer.invoke('MARK_AS_STOPPED_OFFLINE');
								} finally {
									this._startMode = TimerStartMode.STOP;
									this.timeTrackerStore.ignition({
										state: IgnitionState.STOPPED,
										mode: this._startMode
									});
								}
							}
							const isDeleted = await this.timeTrackerService.deleteTimeSlots(timeSlotPayload);
							if (isDeleted) {
								console.log('SUCCESS: Deleted');
							} else {
								console.warn('WARN: Unexpected error appears.');
							}
						}

						this._isLockSyncProcess = false;

						asapScheduler.schedule(async () => {
							const { lastLog: lastTimer } = await this._timeTrackerStatus.status();

							if (this.start && lastTimer) {
								event.sender.send('update_session', lastTimer);
							}

							try {
								const timeSlotId = arg.timer?.timeslotId;

								await this.electronService.ipcRenderer.invoke('UPDATE_SYNCED_TIMER', {
									...arg.timer,
									...(timeSlotId && { timeSlotId }),
									...(lastTimer && { lastTimer })
								});
							} catch (error) {
								this._errorHandlerService.handleError(error);
							}
						});
					} else {
						if (this.start && !arg.isWorking) await this.toggleStart(false);
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

		this._languageElectronService.initialize();

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
			return;
		} else {
			this.isProcessingEnabled = true;
		}
		this.loading = true;

		if (this.timerSubscription) {
			this.timerSubscription.unsubscribe();
		}

		this.timerSubscription = timer(BLOCK_DELAY)
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.loading = false;
				this.isProcessingEnabled = false;
				this._loggerService.info('Processing Unlocked');
				this.timerSubscription = null;
			});

		if (!val) {
			console.log('Stop tracking');

			this.timeTrackerStore.ignition({ state: IgnitionState.STOPPING });

			await this.stopTimer(onClick);

			this.refreshTimer();

			this.loading = false;

			return;
		} else {
			console.log('Start tracking');

			this.timeTrackerStore.ignition({ state: IgnitionState.STARTING });

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
				this._toastrNotifier.error('Validation failed');
				this._loggerService.error('Error', 'validation failed');
				this.timeTrackerStore.ignition({ state: IgnitionState.STOPPED });
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
				await this.getTodayTime();
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
				projectId: this.projectSelectorService.selectedId,
				taskId: this.taskSelectorService.selectedId,
				organizationContactId: this.clientSelectorService.selectedId,
				note: this.noteService.note,
				aw: {
					host: this._environment?.AWHost,
					isAw: this._activityWatchViewService.aw
				},
				timeLog: null,
				isRemoteTimer: this.isRemoteTimer,
				organizationTeamId: this.teamSelectorService.selectedId
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

				const activities = await this.electronService.ipcRenderer.invoke('COLLECT_ACTIVITIES', {
					quitApp: this.quitApp
				});

				asyncScheduler.schedule(async () => {
					this._loggerService.info('Capturing Screen and Sending Activities Start...', activities);
					await this.takeCaptureAndSendActivities(activities);
					this._loggerService.info('Capturing Screen and Sending Activities Done ✔️');
					this.isProcessingEnabled = false;
				}, 1000);
			}

			console.log('Updating Task Status');
			await this.updateTaskStatus();

			console.log('Updating Organization Team Employee');
			await this.updateOrganizationTeamEmployee();

			this.electronService.ipcRenderer.send('request_permission');

			this.electronService.ipcRenderer.send('start-capture-screen');

			this.timeTrackerStore.ignition({ state: IgnitionState.STARTED, mode: this._startMode });
		} catch (error) {
			this._startMode = TimerStartMode.STOP;
			this.start$.next(false);
			this.timeTrackerStore.ignition({ state: IgnitionState.STOPPED, mode: this._startMode });
			this._errorHandlerService.handleError(error);
		} finally {
			this.loading = false;
			if (this.isRemoteTimer) {
				this.isProcessingEnabled = false;
			}
		}
	}

	public async stopTimer(onClick = true, isEmergency = false): Promise<void> {
		if (!this.start && !isEmergency) {
			console.log('This timer is already stopped');
			return;
		}
		try {
			this.loading = true;

			const config = { quitApp: this.quitApp, isEmergency };

			let timer;

			this.electronService.ipcRenderer.send('stop-capture-screen');

			if (this._startMode === TimerStartMode.MANUAL) {
				console.log('Taking screen capture');
				// Collect activities
				const activities = await this.electronService.ipcRenderer.invoke('COLLECT_ACTIVITIES', config);
				// Stop timer locally and return current state of timer
				console.log('Stopping timer');
				timer = await this.electronService.ipcRenderer.invoke('STOP_TIMER', config);
				// Update tray
				console.log('Updating Tray stop');
				this.electronService.ipcRenderer.send('update_tray_stop');
				// Update view
				this.start$.next(false);
				// Stop loading
				this.loading = false;
				/*
					Start network processing...
				*/
				// Make sure it's not a remote timer
				if (!this.isRemoteTimer) {
					this._loggerService.info('Capturing Screen and Sending Activities Start...', activities);
					// Create time slot and return time slot ID and error
					const { timeSlotId, error } = await this.createTimeSlot(activities);
					// Upload screenshots if available
					asyncScheduler.schedule(async () => {
						// Take Screenshots
						const screenshots = await this.takeScreenCapture(activities);
						//Check there's an error
						if (error) {
							// handle create time slot error
							this.handleCreateTimeSlotError(error, activities, screenshots);
						}
						// Upload screenshots if timeslot and screenshots is available
						if (timeSlotId && screenshots?.length > 0) {
							await this.uploadScreenshots(activities, timeSlotId, screenshots);
							this._loggerService.info('Capturing Screen and Sending Activities Done ✔️');
						}
						this.isProcessingEnabled = false;
					}, 1000);
				}
			} else {
				// Stop timer locally and return current state
				timer = await this.electronService.ipcRenderer.invoke('STOP_TIMER', config);
				// Update tray
				console.log('Updating Tray stop');
				this.electronService.ipcRenderer.send('update_tray_stop');
				// Update view
				this.start$.next(false);
				// Stop loading
				this.loading = false;
			}
			// Stop timer on server
			console.log('Toggling timer');
			await this._toggle(timer, onClick);
			/**
			 * End network processing
			 */

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
			this._session = null;
			this.loading = false;
			if (this.isRemoteTimer) {
				this.isProcessingEnabled = false;
			}
			this.timeTrackerStore.ignition({ state: IgnitionState.STOPPED, mode: this._startMode });
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

	public descriptionChange(e): void {
		if (e) this.errors.note = false;
		this.electronService.ipcRenderer.send('update_project_on', {
			note: this.noteService.note
		});
	}

	public validationField(): boolean {
		const selectorValidator = new SelectorValidator([
			{
				service: this.projectSelectorService,
				requireField: this.userOrganization.requireProject
			},
			{
				service: this.taskSelectorService,
				requireField: this.userOrganization.requireTask
			},
			{
				service: this.clientSelectorService,
				requireField: this.userOrganization.requireClient
			},
			{
				service: this.noteService,
				requireField: this.userOrganization.requireDescription
			}
		]);

		return selectorValidator.validateAll();
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

	public async getTodayTime(isForcedSync = false): Promise<void> {
		if (this._isOffline) return;
		try {
			const res = await this.timeTrackerService.getTimeLogs();
			if (res) {
				this.countDuration(res, isForcedSync);
			}
		} catch (error) {
			console.log('ERROR', error);
		}
	}

	public async getLastTimeSlotImage(arg): Promise<void> {
		if (this._isOffline || this.lastTimeSlot?.id === arg?.timeSlotId) {
			return;
		}
		try {
			const res = await this.timeTrackerService.getTimeSlot(arg);
			const { screenshots = [] } = res || {};
			console.log('Get Last Timeslot Image Response:', screenshots);
			if (screenshots && screenshots.length > 0) {
				const [lastCaptureScreen] = screenshots;
				console.log('Last Capture Screen:', lastCaptureScreen);
				this.lastScreenCapture$.next(lastCaptureScreen);
				await this.localImage(this.lastScreenCapture);
				this.screenshots$.next(screenshots);
				this.lastTimeSlot = res;
			}
			if (this.lastScreenCapture?.recordedAt) {
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

	public async localImage(
		img: { thumbUrl?: string; recordedAt?: string; fullUrl?: string } | string,
		originalBase64Image?: string
	): Promise<void> {
		try {
			// Determine the fullUrl, prioritizing originalBase64Image if provided
			const fullUrl = originalBase64Image || (typeof img === 'object' ? img.fullUrl : undefined);

			// Fetch the thumbnail or use the image string directly if img is a string
			const thumbUrl =
				typeof img === 'object' && img.thumbUrl
					? await this._imageViewerService.getBase64ImageFromUrl(img.thumbUrl)
					: typeof img === 'string'
					? img
					: undefined;

			// Set timestamp, preferring recordedAt if available
			const timestamp = typeof img === 'object' && img.recordedAt ? new Date(img.recordedAt) : new Date();

			if (fullUrl && thumbUrl) {
				const screenCaptureData = {
					fullUrl,
					thumbUrl,
					textTime: moment(timestamp).fromNow(),
					createdAt: timestamp,
					recordedAt: timestamp
				};

				localStorage.setItem('lastScreenCapture', JSON.stringify(screenCaptureData));
			} else {
				this._loggerService.warn('WARN: Invalid image data: missing fullUrl or thumbUrl.');
			}
		} catch (error) {
			this._loggerService.error('ERROR: Storing image:', error.message);
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
		if (!this.screenshots.length) {
			const message = 'Attempted to open an empty image gallery.';
			this.toastrService.warning(message);
			this._loggerService.warn(`WARN: ${message}`);
			return;
		}
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
					if (this.start) {
						await this.toggleStart(false);
					}
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
				await this.preventDuplicateApiRequest(arg, (payload) => this.timeTrackerService.toggleApiStop(payload));
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

	public async takeScreenCapture(arg) {
		let HighResolutionScreenshots = [];
		let lowResolutionScreenshots = [];

		try {
			this._loggerService.info('Take screen capture');
			if (!arg.displays) {
				HighResolutionScreenshots = await this.getScreenshot(arg, false);
				lowResolutionScreenshots = await this.getScreenshot(arg, true);
			} else {
				HighResolutionScreenshots = arg.displays;
			}

			this._loggerService.info('Update timer last capture');
			this.handleLastCapture(HighResolutionScreenshots);

			// notify
			this._loggerService.info('Notify screen capture to user');
			this.screenshotNotify(arg, lowResolutionScreenshots);

			return HighResolutionScreenshots;
		} catch (error) {
			this._loggerService.error('Error on screenshot', error);
		}
	}

	public checkSendActivitiesValidationFail(arg) {
		this._loggerService.info('sendActivities');

		if (this.isRemoteTimer) {
			this._loggerService.info('isRemoteTimer exit from sendActivities');
			return true;
		}

		if (!arg) {
			this._loggerService.info('No data available to send from sendActivities');
			return true;
		}

		return false;
	}

	public async handleLastCapture(screenshots: any[]) {
		if (!this._isOffline && screenshots.length > 0) {
			/* Converting the screenshot image to a base64 string. */
			const original = `data:image/png;base64, ${this.buffToB64(screenshots[0])}`;

			/* Compressing the image to 320x200 */
			const compressed = await compressImage(original, 320, 200);

			/*  Saving compressed image to the local storage. */
			await this.localImage(compressed, original);

			/* Update image waiting for server response*/
			this.updateImageUrl(null);

			/* Adding the last screen capture to the screenshots array. */
			this.screenshots$.next([...this.screenshots, this.lastScreenCapture]);
		}
	}

	public async uploadScreenshots(arg, timeSlotId: string, screenshots: any[]) {
		this._loggerService.info('Upload screenshot to TimeSlot api');
		try {
			await Promise.all(
				screenshots.map(async (img) => {
					return await this.uploadsScreenshot(arg, img, timeSlotId);
				})
			);
		} catch (error) {
			console.log('ERROR', error);
		}

		this._loggerService.info('Get last time slot image');
		await this.getLastTimeSlotImage({
			...arg,
			token: this.token,
			apiHost: this.apiHost,
			timeSlotId
		});
	}

	private handleCreateTimeSlotError(error: any, arg, screenshots) {
		const paramActivity = this.buildParamActivity(arg);
		this._loggerService.error('Error sending to API timeslot:', error);

		try {
			this.electronService.ipcRenderer.send('failed_synced_timeslot', {
				params: {
					...paramActivity,
					b64Imgs: screenshots.map((img) => ({
						b64img: this.buffToB64(img),
						fileName: this.fileNameFormat(img)
					}))
				}
			});
		} catch (e) {
			this._loggerService.error('Failed to send failed_synced_timeslot event', e);
		}
	}

	private buildParamActivity(arg: any) {
		const { user, organizationId, tenantId } = this._store;
		const {
			employeeId,
			projectId,
			duration,
			keyboard,
			mouse,
			system: overall,
			startedAt,
			activities,
			timeLogId,
			organizationContactId
		} = arg ?? {};

		return {
			employeeId: employeeId ?? user?.employee?.id,
			projectId: projectId ?? null,
			duration: duration ?? 0,
			keyboard: keyboard ?? 0,
			mouse: mouse ?? 0,
			overall: overall ?? null,
			startedAt: startedAt ?? null,
			activities: activities ?? [],
			timeLogId: timeLogId ?? null,
			organizationId: arg?.organizationId ?? organizationId,
			tenantId: arg?.tenantId ?? tenantId,
			organizationContactId: organizationContactId ?? null
		};
	}

	public async createTimeSlot(arg): Promise<{ timeSlotId: string; error: any }> {
		try {
			this._loggerService.info('Build Param Activity');
			const paramActivity = this.buildParamActivity(arg);
			this._loggerService.info('Create Time Slot');
			const { timeLogs, id: timeSlotId } = (await this.timeTrackerService.pushToTimeSlot(
				paramActivity
			)) as ITimeSlotTimeLogs;

			if (!timeLogs?.length) {
				// Stop process if there is no time logs associate to activity result.
				this._loggerService.error('[@SendActivities]', 'No time logs');
				return null;
			}
			this._loggerService.info('Post Create activities');
			this.electronService.ipcRenderer.send('return_time_slot', {
				timerId: arg.timerId,
				timeSlotId,
				quitApp: arg.quitApp,
				timeLogs: timeLogs
			});

			this.electronService.ipcRenderer.send('remove_aw_local_data');

			this.electronService.ipcRenderer.send('remove_wakatime_local_data', {
				idsWakatime: arg.idsWakatime
			});

			this._loggerService.info('Sending create-synced-interval event...');
			this.electronService.ipcRenderer.send('create-synced-interval', {
				...paramActivity,
				remoteId: timeSlotId,
				b64Imgs: []
			});

			return { timeSlotId, error: null };
		} catch (error) {
			return { timeSlotId: null, error };
		}
	}

	public async takeCaptureAndSendActivities(activities) {
		// Check validations
		if (this.isRemoteTimer) return;
		// Create time slot and return time slot ID
		const { timeSlotId, error } = await this.createTimeSlot(activities);
		// Take Screenshots
		const screenshots = await this.takeScreenCapture(activities);
		// Check if error
		if (error) {
			// handle create time slot error
			this.handleCreateTimeSlotError(error, activities, screenshots);
		}
		// Upload screenshots if available
		if (timeSlotId && screenshots?.length > 0) {
			await this.uploadScreenshots(activities, timeSlotId, screenshots);
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

	public async restart(callback?: Function): Promise<any> {
		// If the timer is running as a viewer, no need to restart
		if (this.isRemoteTimer) {
			return;
		}

		// Lock restart process
		this._isLockSyncProcess = true;

		try {
			// Resolve promise and debounce to avoid rapid calls
			return await lastValueFrom(
				from(this.toggleStart(false)).pipe(
					debounceTime(200),
					concatMap(() => (callback ? from(callback()) : of(null))), // Safely execute callback
					concatMap(async (callbackResult) => {
						await this.toggleStart(true); // Restart process
						return callbackResult; // Return the callback result
					}),
					untilDestroyed(this)
				)
			);
		} catch (error) {
			// Force stop timer on error
			try {
				if (this.stopTimer) {
					await this.stopTimer(!this.isRemoteTimer, true);
				}
			} catch (stopError) {
				this._loggerService?.error('Error in force stopping the timer', stopError);
			}
		} finally {
			// Unlock restart process
			this._isLockSyncProcess = false;
		}
	}

	public async updateOrganizationTeamEmployee(): Promise<void> {
		try {
			if (!this.selectedTask || !this.selectedTeam || !this.hasActiveTaskPermissions) {
				return;
			}
			const organizationTeamId = this.teamSelectorService.selectedId;
			const { tenantId, organizationId, user } = this._store;
			const { id: employeeId } = user.employee;
			const activeTaskId = this.taskSelectorService.selectedId;
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

	private async updateTaskStatus() {
		try {
			const { tenantId, organizationId } = this._store;
			if (!this.selectedTask || this.selectedTask.status === TaskStatusEnum.IN_PROGRESS) {
				return;
			}
			const id = this.taskSelectorService.selectedId;
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
			return { state: this._isSpecialLogout, message: 'TIMER_TRACKER.LOADING.LOGOUT_IN_PROGRESS' };
		}

		if (this.quitApp) {
			return { state: this.quitApp, message: 'TIMER_TRACKER.LOADING.SHUTTING_DOWN' };
		}

		return { state: false, message: this._translateService.instant('TIMER_TRACKER.LOADING.PLEASE_HOLD') };
	}

	private async preventDuplicateApiRequest<T, U>(payload: T, callback: (payload: T) => Promise<U>): Promise<U> {
		return lastValueFrom(of(payload).pipe(distinctUntilChange(), concatMap(callback), untilDestroyed(this)));
	}

	private async silentRestart<S, T, U>(session?: {
		callback?: (options?: T) => Promise<U>;
		params?: S;
	}): Promise<{ result: U | void; params: S; current: ITimeLog; previous: ITimeLog }> {
		const timer = await this.electronService.ipcRenderer.invoke('CURRENT_TIMER');
		const interval = await this.electronService.ipcRenderer.invoke('LAST_SYNCED_INTERVAL');
		const params = {
			organizationId: interval.organizationId,
			tenantId: interval.tenantId,
			organizationContactId: interval.organizationContactId,
			projectId: interval.projectId,
			taskId: timer.taskId,
			organizationTeamId: timer.organizationTeamId,
			description: timer.description,
			version: timer.version,
			startedAt: timer.startedAt,
			stoppedAt: new Date(),
			...(session?.params && { ...session.params })
		};

		let previous = null;
		let result: U | void;

		if (this.start) {
			previous = await this.preventDuplicateApiRequest(params, (payload) =>
				this.timeTrackerService.toggleApiStop(payload)
			);
		}

		// Check if the callback is provided and call it
		if (session?.callback) {
			result = await session?.callback();
		}

		const newParams = {
			...params,
			description: this.noteService.note,
			taskId: this.taskSelectorService.selectedId,
			projectId: this.projectSelectorService.selectedId,
			organizationTeamId: this.teamSelectorService.selectedId,
			organizationContactId: this.clientSelectorService.selectedId,
			startedAt: new Date(),
			timerId: timer.id
		};

		const current = (await this.preventDuplicateApiRequest(newParams, (payload) =>
			this.timeTrackerService.toggleApiStart(payload)
		)) as ITimeLog;

		await this.getTodayTime(true);

		await this.electronService.ipcRenderer.invoke('UPDATE_SELECTOR', newParams);

		await this.updateTaskStatus();

		await this.updateOrganizationTeamEmployee();
		// Return the result of the callback (or void if no callback was provided)
		return { current, previous, result, params };
	}

	public tabs$ = new BehaviorSubject<NbRouteTab[]>([
		{
			title: this._translateService.instant('MENU.TASKS'),
			route: ['/', 'time-tracker', 'tasks'],
			activeLinkOptions: { exact: false },
			disabled: this._isOffline
		},
		{
			title: this._translateService.instant('TIMER_TRACKER.MENU.DAILY_RECAP'),
			route: ['/', 'time-tracker', 'daily'],
			activeLinkOptions: { exact: false },
			disabled: this._isOffline
		},
		{
			title: this._translateService.instant('TIMER_TRACKER.MENU.WEEKLY_RECAP'),
			route: ['/', 'time-tracker', 'weekly'],
			disabled: this._isOffline
		},
		{
			title: this._translateService.instant('TIMER_TRACKER.MENU.MONTHLY_RECAP'),
			route: ['/', 'time-tracker', 'monthly'],
			disabled: this._isOffline
		}
	]);
}
