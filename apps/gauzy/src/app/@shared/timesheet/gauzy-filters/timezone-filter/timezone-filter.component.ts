import { AfterViewInit, Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest, filter } from 'rxjs';
import { tap } from 'rxjs/operators';
import * as moment from 'moment-timezone';
import { distinctUntilChange } from '@gauzy/ui-sdk/common';
import { NavigationService } from '@gauzy/ui-sdk/core';
import {
	DEFAULT_TIME_FORMATS,
	IOrganization,
	IUser,
	PermissionsEnum,
	TimeFormatEnum,
	TimeZoneEnum
} from '@gauzy/contracts';
import { Store } from '../../../../@core/services';
import { TimeZoneService } from './time-zone.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-timezone-filter',
	templateUrl: './timezone-filter.component.html',
	styleUrls: ['./timezone-filter.component.scss']
})
export class TimezoneFilterComponent implements AfterViewInit, OnInit, OnDestroy {
	timeZoneOptions: { value: TimeZoneEnum; label: string }[] = [
		{ value: TimeZoneEnum.UTC_TIMEZONE, label: 'UTC' },
		{ value: TimeZoneEnum.ORG_TIMEZONE, label: 'Org Timezone' },
		{ value: TimeZoneEnum.MINE_TIMEZONE, label: 'My Timezone' }
	];
	timeFormatsOptions = DEFAULT_TIME_FORMATS;
	selectedTimeFormat: TimeFormatEnum = TimeFormatEnum.FORMAT_12_HOURS;
	selectedTimeZone: TimeZoneEnum = TimeZoneEnum.UTC_TIMEZONE;

	@Input() isTimezone: boolean = true;
	@Input() isTimeformat: boolean = true;

	@Output() timeZoneChange = new EventEmitter<string>();
	@Output() timeFormatChange = new EventEmitter<TimeFormatEnum>();

	constructor(
		private readonly _route: ActivatedRoute,
		private readonly _store: Store,
		private readonly _navigationService: NavigationService,
		private readonly _timeZoneService: TimeZoneService
	) {}

	ngOnInit(): void {
		// Extract query parameter
		const queryParams$ = this._route.queryParams.pipe(
			filter((params: Params) => !!params),
			distinctUntilChange()
		);
		const storeOrganization$ = this._store.selectedOrganization$.pipe(
			filter((organization: IOrganization) => !!organization),
			filter(() => this.hasChangeSelectedEmployeePermission()),
			distinctUntilChange()
		);
		combineLatest([queryParams$, storeOrganization$])
			.pipe(
				tap(([queryParams, organization]) => {
					if (this.isTimeformat) this.applyTimeFormat(queryParams, organization.timeFormat);
					if (this.isTimezone) this.applyTimeZone(queryParams, TimeZoneEnum.ORG_TIMEZONE);
				}),
				// Handle component lifecycle to avoid memory leaks
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		// Extract query parameter
		const queryParams$ = this._route.queryParams.pipe(
			filter((params: Params) => !!params),
			distinctUntilChange()
		);
		const storeUser$ = this._store.user$.pipe(
			filter((user: IUser) => !!user),
			filter(() => !this.hasChangeSelectedEmployeePermission())
		);
		combineLatest([queryParams$, storeUser$])
			.pipe(
				distinctUntilChange(),
				tap(([queryParams, user]) => {
					if (this.isTimeformat) this.applyTimeFormat(queryParams, user.timeFormat);
					if (this.isTimezone) this.applyTimeZone(queryParams, TimeZoneEnum.MINE_TIMEZONE);
				}),
				// Handle component lifecycle to avoid memory leaks
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Applies the appropriate time format based on query parameters, organization settings, and employee settings.
	 *
	 * @param queryParams The query parameters from the route.
	 * @param organization The organization details.
	 */
	private applyTimeFormat(queryParams: Params, timeFormat: number): void {
		const { time_format } = queryParams;

		// Apply query parameters first
		if (time_format) {
			this.selectTimeFormat(parseInt(time_format, 10));
		} else {
			this.selectTimeFormat(timeFormat);
		}
	}

	/**
	 * Applies the appropriate time zone based on query parameters and organization settings.
	 * @param queryParams The query parameters from the route.
	 * @param organization The organization details.
	 */
	private applyTimeZone(queryParams: Params, timeZone: TimeZoneEnum): void {
		const { time_zone } = queryParams;

		// Apply query parameters first
		if (time_zone) {
			this.selectTimeZone(time_zone);
		} else {
			this.selectTimeZone(timeZone);
		}
	}

	/**
	 * Sets the selected time format based on the provided time format.
	 *
	 * @param timeFormat The time format to set.
	 */
	selectTimeFormat(timeFormat: TimeFormatEnum): void {
		const is24Hours = timeFormat == TimeFormatEnum.FORMAT_24_HOURS;
		this.selectedTimeFormat = is24Hours ? TimeFormatEnum.FORMAT_24_HOURS : TimeFormatEnum.FORMAT_12_HOURS;

		this.timeFormatChange.emit(this.selectedTimeFormat);
	}

	/**
	 * Sets the selected timezone based on the provided timezone enum value.
	 *
	 * @param timeZone The timezone enum value to set.
	 */
	selectTimeZone(timeZone: TimeZoneEnum): void {
		switch (timeZone) {
			case TimeZoneEnum.ORG_TIMEZONE:
			case TimeZoneEnum.MINE_TIMEZONE:
				this.selectedTimeZone = timeZone;
				break;
			default:
				this.selectedTimeZone = TimeZoneEnum.UTC_TIMEZONE;
				break;
		}

		const timezone = this.getMomentTimezone(this.selectedTimeZone);
		this._timeZoneService.setTimeZone(timezone);

		this.timeZoneChange.emit(timezone);
	}

	/**
	 * Updates the selected time format and updates the corresponding query parameter.
	 *
	 * @param timeFormat The time format to update.
	 */
	async updateSelectedTimeFormat(timeFormat: TimeFormatEnum): Promise<void> {
		// Update the selected time format
		this.selectTimeFormat(timeFormat);

		// Updates the query parameters of the current route without navigating away.
		await this._navigationService.updateQueryParams({
			time_format: timeFormat.toString()
		});
	}

	/**
	 * Updates the selected time zone and updates the corresponding query parameter.
	 *
	 * @param timeZone The time zone to update.
	 */
	async updateSelectedTimeZone(timeZone: TimeZoneEnum): Promise<void> {
		// Update the selected time zone
		this.selectTimeZone(timeZone);

		// Updates the query parameters of the current route without navigating away.
		await this._navigationService.updateQueryParams({
			time_zone: timeZone.toString()
		});
	}

	/**
	 * Retrieves the timezone abbreviation with the region and city for the given zone.
	 *
	 * @returns
	 */
	getTimeZoneWithOffset(): string {
		const zone = this._timeZoneService.currentTimeZone;

		let region = '';
		let city = '';

		// Split the zone into region and city if it contains '/'
		if (zone.includes('/')) {
			[region, city] = zone.split('/');
			city = city.replace('_', ' '); // Replace underscores with spaces if any
		} else {
			city = zone;
		}

		// Get the timezone abbreviation
		const offset = moment.tz(zone).format('z');

		// Construct the return string
		return `${offset}: ${region} - ${city}`;
	}

	/**
	 * Gets the time zone based on the selected time zone.
	 *
	 * @returns The time zone string.
	 */
	getMomentTimezone(zone: string): string {
		const defaultTimeZone = 'Etc/UTC';
		let timeZone: string;

		switch (zone) {
			case TimeZoneEnum.MINE_TIMEZONE:
				timeZone = this._store.user?.timeZone || moment.tz.guess();
				break;
			case TimeZoneEnum.ORG_TIMEZONE:
				timeZone = this._store.selectedOrganization?.timeZone || defaultTimeZone;
				break;
			case TimeZoneEnum.UTC_TIMEZONE:
			default:
				timeZone = defaultTimeZone;
				break;
		}
		return timeZone;
	}

	/**
	 * Checks if the current user has the permission to change the selected employee.
	 *
	 * @returns A boolean indicating if the user has the CHANGE_SELECTED_EMPLOYEE permission.
	 */
	private hasChangeSelectedEmployeePermission(): boolean {
		return this._store.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);
	}

	/**
	 *
	 */
	ngOnDestroy(): void {}
}
