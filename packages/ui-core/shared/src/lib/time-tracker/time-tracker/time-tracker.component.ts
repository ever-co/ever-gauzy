import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import { NgxDraggableDomMoveEvent, NgxDraggablePoint } from 'ngx-draggable-dom';
import { NbThemeService } from '@nebular/theme';
import * as moment from 'moment';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest, Observable, Subject, Subscription } from 'rxjs';
import { filter, takeUntil, tap } from 'rxjs/operators';
import { faStopwatch, faPlay, faPause } from '@fortawesome/free-solid-svg-icons';
import { IOrganization, IUser, TimeLogType, IEmployee, ITimerToggleInput, ITask } from '@gauzy/contracts';
import { distinctUntilChange, toLocal } from '@gauzy/ui-core/common';
import {
	ErrorHandlingService,
	ITimerSynced,
	Store,
	TimeTrackerService,
	TimeTrackerSocketService
} from '@gauzy/ui-core/core';
import { TimeTrackerStatusService } from '../components/time-tracker-status/time-tracker-status.service';
import { Environment, environment } from '@gauzy/ui-config';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-web-time-tracker',
	templateUrl: './time-tracker.component.html',
	styleUrls: ['./time-tracker.component.scss'],
	standalone: false
})
export class TimeTrackerComponent implements OnInit, OnDestroy {
	// This constant holds the URL for downloading content from the platform's website.
	readonly PLATFORM_WEBSITE_DOWNLOAD_URL: Environment['PLATFORM_WEBSITE_DOWNLOAD_URL'] =
		environment.PLATFORM_WEBSITE_DOWNLOAD_URL;

	play = faPlay;
	pause = faPause;
	stopwatch = faStopwatch;
	isDisable = false;
	isOpen = false;
	isExpanded = true;
	futureDateAllowed: IOrganization['futureDateAllowed'] = false;
	todaySessionTime = moment().set({ hour: 0, minute: 0, second: 0 }).format('HH:mm:ss');
	currentSessionTime = moment().set({ hour: 0, minute: 0, second: 0 }).format('HH:mm:ss');
	running: boolean;
	user: IUser;
	employee: IEmployee;
	organization: IOrganization;
	timeLogType = TimeLogType;
	limitReached = false;
	theme: string;

	@ViewChild(NgForm) form: NgForm;

	trackType$: Observable<string> = this.timeTrackerService.trackType$;
	hasRolledOverToday$ = this.timeTrackerService.hasRolledOverToday$;
	willRollOverSoon$ = this.timeTrackerService.willRollOverSoon$;
	private runningSubscription: Subscription;
	private readonly workedThisWeek$: Observable<number> = this.timeTrackerService.workedThisWeek$;
	private readonly reWeeklyLimit$: Observable<number> = this.timeTrackerService.reWeeklyLimit$;
	private readonly destroy$ = new Subject<void>();

	constructor(
		private readonly timeTrackerService: TimeTrackerService,
		private readonly store: Store,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly themeService: NbThemeService,
		private readonly _timeTrackerStatusService: TimeTrackerStatusService,
		private readonly _socketService: TimeTrackerSocketService
	) {
		this._timeTrackerStatusService.external$
			.pipe(
				filter((timerSynced: ITimerSynced) => this.xor(this.running, timerSynced.running)),
				tap(async (timerSynced: ITimerSynced) => {
					this.timeTrackerService.currentSessionDuration = moment().diff(
						toLocal(timerSynced.startedAt),
						'seconds'
					);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Gets the value indicating whether the task is billable.
	 *
	 * @returns A boolean indicating if the task is billable.
	 */
	public get isBillable(): boolean {
		return this.timeTrackerService.timerConfig.isBillable;
	}

	/**
	 * Sets the value indicating whether the task is billable.
	 *
	 * @param value - A boolean indicating if the task should be billable.
	 */
	public set isBillable(value: boolean) {
		this.updateTimerConfig({ isBillable: value });
	}

	/**
	 * Gets the current task ID associated with the timer configuration.
	 *
	 * @returns The task ID if it exists and is a string; otherwise, null.
	 */
	public get taskId(): string | null {
		return this.getStringConfigValue('taskId');
	}

	/**
	 * Sets the task ID for the timer configuration.
	 *
	 * @param value - The task ID to set.
	 */
	public set taskId(value: string) {
		this.updateTimerConfig({ taskId: value });
	}

	/**
	 * Gets the current task title associated with the timer configuration.
	 *
	 * @returns The task title if it exists and is a string; otherwise, null.
	 */
	public get taskTitle(): string | null {
		return this.getStringConfigValue('taskTitle');
	}

	/**
	 * Sets the task title for the timer configuration.
	 *
	 * @param value - The task title to set.
	 */

	public set taskTitle(value: string | null) {
		this.updateTimerConfig({ taskTitle: value });
	}

	/**
	 * Gets the project ID associated with the timer configuration.
	 *
	 * @returns The project ID if it exists and is a string; otherwise, null.
	 */
	public get projectId(): string | null {
		return this.getStringConfigValue('projectId');
	}

	/**
	 * Sets the project ID for the timer configuration.
	 *
	 * @param value - The project ID to set.
	 */
	public set projectId(value: string) {
		this.updateTimerConfig({ projectId: value });
	}

	/**
	 * Gets the description from the timer configuration.
	 *
	 * @returns The description if it exists and is a string; otherwise, null.
	 */
	public get description(): string | null {
		return this.getStringConfigValue('description');
	}

	/**
	 * Sets the description for the timer configuration.
	 *
	 * @param value - The description to set.
	 */
	public set description(value: string) {
		this.updateTimerConfig({ description: value });
	}

	/**
	 * Updates the timer configuration with new values.
	 *
	 * @param updates - An object containing the properties to update in the timer configuration.
	 */
	private updateTimerConfig(updates: Partial<ITimerToggleInput>): void {
		this.timeTrackerService.timerConfig = {
			...this.timeTrackerService.timerConfig,
			...updates
		};
	}

	/**
	 * Retrieves the value of a specified string property from the timer configuration.
	 *
	 * @param key - The name of the property to retrieve.
	 * @returns The value of the property if it exists and is a string; otherwise, null.
	 */
	private getStringConfigValue(key: keyof ITimerToggleInput): string | null {
		const value = this.timeTrackerService.timerConfig[key];
		return typeof value === 'string' ? value : null;
	}

	/**
	 * Gets the current position of the timer.
	 *
	 * @returns The current position or offset of the timer.
	 */
	public get position(): NgxDraggablePoint {
		return this.timeTrackerService.position;
	}

	/**
	 * Sets the position of the timer.
	 *
	 * @param offSet - The offset value to set for the timer's position.
	 */
	public set position(offSet: NgxDraggablePoint) {
		this.timeTrackerService.position = offSet;
	}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => {
					this.organization = organization;
					this.futureDateAllowed = organization.futureDateAllowed;
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.user$
			.pipe(
				filter((user: IUser) => !!user),
				tap((user: IUser) => (this.user = user)),
				tap((user: IUser) => (this.employee = user?.employee)),
				untilDestroyed(this)
			)
			.subscribe();
		this.timeTrackerService.showTimerWindow$
			.pipe(
				tap((isOpen) => (this.isOpen = isOpen)),
				untilDestroyed(this)
			)
			.subscribe();
		combineLatest([this.timeTrackerService.currentSessionDuration$, this.timeTrackerService.duration$])
			.pipe(
				tap(([currentSessionDuration, duration]) => {
					this.currentSessionTime = moment.utc(currentSessionDuration * 1000).format('HH:mm:ss');

					this.todaySessionTime = moment.utc(duration * 1000).format('HH:mm:ss');
				}),
				untilDestroyed(this)
			)
			.subscribe(() => {
				if (this.running) {
					// Periodically check if it's midnight (when the timer is running).
					// If so, attempt a safe rollover: stop the current timer before midnight
					// and start a new session just after midnight to avoid crossing date boundaries.
					this.timeTrackerService.isMidnight();
				}
			});
		this.runningSubscription = this.timeTrackerService.running$
			.pipe(
				tap((isRunning) => (this.running = isRunning)),
				untilDestroyed(this)
			)
			.subscribe((running) => (this.running = running));
		this.themeService
			.onThemeChange()
			.pipe(
				tap((theme) => (this.theme = theme.name)),
				untilDestroyed(this)
			)
			.subscribe();

		combineLatest([this.workedThisWeek$, this.reWeeklyLimit$])
			.pipe(takeUntil(this.destroy$))
			.subscribe(async () => {
				this.limitReached = this.timeTrackerService.hasReachedWeeklyLimit();
				if (this.limitReached) {
					this.timeTrackerService.turnOffTimer();
					this.isDisable = true;
				} else {
					this.isDisable = false;
				}
			});

		/**
		 * Perform the initial status check after user login or service initialization.
		 * Ensures that the current timer status is loaded immediately,
		 * before any "timer:changed" events are received from the socket.
		 */
		const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		this.timeTrackerService.checkTimerStatus({
			tenantId: this.store.tenantId,
			organizationId: this.store.organizationId,
			relations: ['employee'],
			timeZone
		});
		this._socketService.timerSocketStatus$.pipe(untilDestroyed(this)).subscribe();
	}

	toggleWindow() {
		if (!this.isOpen) {
			this.show();
		} else {
			this.hide();
		}
	}

	show() {
		this.timeTrackerService.showTimerWindow = true;
	}

	hide() {
		this.timeTrackerService.showTimerWindow = false;
	}

	async toggleTimer(onClick?: boolean) {
		if (this.limitReached) return this.timeTrackerService.turnOffTimer();
		try {
			if (!this.running && this.form.invalid) {
				this.form.resetForm();
				return;
			}
		} catch (error) {
			this.toggleWindow();
			this.isExpanded = false;
		}
		try {
			this.isDisable = true;
			if (
				this.timeTrackerService.timerSynced &&
				this.xor(this.running, this.timeTrackerService.timerSynced.running) &&
				!onClick &&
				this.timeTrackerService.timerSynced.isExternalSource
			) {
				this.running = this.timeTrackerService.timerSynced.running;
				this.timeTrackerService.remoteToggle();
			} else {
				await this._timeTrackerStatusService.status();
				if (this.limitReached) return;
				await this.timeTrackerService.toggle();
			}
		} catch (error) {
			this._errorHandlingService.handleError(error);
		}
		this.isDisable = false;
	}

	setTimeType(type: string) {
		this.timeTrackerService.setTimeLogType(type);
	}

	onTaskSelected(task: ITask) {
		this.taskTitle = task?.title ?? null;
	}

	/**
	 * Draggable Web Timer Position
	 *
	 * @param event
	 */
	draggablePosition(event: NgxDraggableDomMoveEvent) {
		this.position = event.position;
	}

	public xor(a: boolean, b: boolean): boolean {
		return (!a && b) || (a && !b);
	}

	ngOnDestroy() {
		if (this.runningSubscription) {
			this.runningSubscription.unsubscribe();
		}

		this.destroy$.next();
		this.destroy$.complete();
	}
}
