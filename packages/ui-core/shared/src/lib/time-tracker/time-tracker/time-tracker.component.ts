import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import { NgxDraggableDomMoveEvent, NgxDraggablePoint } from 'ngx-draggable-dom';
import { NbThemeService } from '@nebular/theme';
import * as moment from 'moment';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Observable } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { faStopwatch, faPlay, faPause } from '@fortawesome/free-solid-svg-icons';
import { Environment, environment } from '@gauzy/ui-config';
import { IOrganization, IUser, TimeLogType, IEmployee, ITimerToggleInput } from '@gauzy/contracts';
import { distinctUntilChange, toLocal } from '@gauzy/ui-core/common';
import { ErrorHandlingService, ITimerSynced, Store, TimeTrackerService } from '@gauzy/ui-core/core';
import { TimeTrackerStatusService } from '../components/time-tracker-status/time-tracker-status.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-web-time-tracker',
	templateUrl: './time-tracker.component.html',
	styleUrls: ['./time-tracker.component.scss']
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
	hideAlert = false;

	@ViewChild(NgForm) form: NgForm;

	trackType$: Observable<string> = this.timeTrackerService.trackType$;
	theme: string;

	constructor(
		private readonly timeTrackerService: TimeTrackerService,
		private readonly store: Store,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly themeService: NbThemeService,
		private readonly _timeTrackerStatusService: TimeTrackerStatusService
	) {
		this._timeTrackerStatusService.external$
			.pipe(
				filter((timerSynced: ITimerSynced) => this.xor(this.running, timerSynced.running)),
				tap(async (timerSynced: ITimerSynced) => {
					this.timeTrackerService.currentSessionDuration = moment().diff(
						toLocal(timerSynced.startedAt),
						'seconds'
					);
					await this.toggleTimer(false);
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
	 * Gets the organization contact ID from the timer configuration.
	 *
	 * @returns The organization contact ID if it exists and is a string; otherwise, null.
	 */
	public get organizationContactId(): string | null {
		return this.getStringConfigValue('organizationContactId');
	}

	/**
	 * Sets the organization contact ID for the timer configuration.
	 *
	 * @param value - The organization contact ID to set.
	 */
	public set organizationContactId(value: string) {
		this.updateTimerConfig({ organizationContactId: value });
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
	 * Gets the organization team ID associated with the timer configuration.
	 *
	 * @returns The organization team ID if it exists and is a string; otherwise, null.
	 */
	public get organizationTeamId(): string | null {
		return this.getStringConfigValue('organizationTeamId');
	}

	/**
	 * Sets the organization team ID for the timer configuration.
	 *
	 * @param value - The organization team ID to set.
	 */
	public set organizationTeamId(value: string) {
		this.updateTimerConfig({ organizationTeamId: value });
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
		this.timeTrackerService.duration$
			.pipe(
				tap((time) => (this.todaySessionTime = moment.utc(time * 1000).format('HH:mm:ss'))),
				untilDestroyed(this)
			)
			.subscribe();
		this.timeTrackerService.showTimerWindow$
			.pipe(
				tap((isOpen) => (this.isOpen = isOpen)),
				untilDestroyed(this)
			)
			.subscribe();
		this.timeTrackerService.currentSessionDuration$
			.pipe(
				tap((time) => (this.currentSessionTime = moment.utc(time * 1000).format('HH:mm:ss'))),
				untilDestroyed(this)
			)
			.subscribe();
		this.timeTrackerService.$running
			.pipe(
				tap((isRunning) => (this.running = isRunning)),
				untilDestroyed(this)
			)
			.subscribe();
		this.themeService
			.onThemeChange()
			.pipe(
				tap((theme) => (this.theme = theme.name)),
				untilDestroyed(this)
			)
			.subscribe();
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
			this.timeTrackerService.timerSynced &&
			this.xor(this.running, this.timeTrackerService.timerSynced.running) &&
			!onClick &&
			this.timeTrackerService.timerSynced.isExternalSource
				? this.timeTrackerService.remoteToggle()
				: await this.timeTrackerService.toggle();
		} catch (error) {
			if (this.timeTrackerService.interval) {
				this.timeTrackerService.turnOffTimer();
			} else {
				this.timeTrackerService.turnOnTimer();
			}
			this._errorHandlingService.handleError(error);
		}
		this.isDisable = false;
	}

	setTimeType(type: string) {
		this.timeTrackerService.setTimeLogType(type);
	}

	/**
	 * Draggable Web Timer Position
	 *
	 * @param event
	 */
	draggablePosition(event: NgxDraggableDomMoveEvent) {
		this.position = event.position as NgxDraggablePoint;
	}

	public xor(a: boolean, b: boolean): boolean {
		return (!a && b) || (a && !b);
	}

	ngOnDestroy() {}
}
