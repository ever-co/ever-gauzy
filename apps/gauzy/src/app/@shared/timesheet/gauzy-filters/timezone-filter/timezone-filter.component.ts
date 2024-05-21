import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest, filter } from 'rxjs';
import { tap } from 'rxjs/operators';
import * as moment from 'moment-timezone';
import { distinctUntilChange } from '@gauzy/ui-sdk/common';
import { DEFAULT_TIME_FORMATS, ISelectedEmployee, TimeFormatEnum, TimeZoneEnum } from '@gauzy/contracts';
import { Store } from '../../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-timezone-filter',
	templateUrl: './timezone-filter.component.html',
	styleUrls: ['./timezone-filter.component.scss']
})
export class TimezoneFilterComponent implements OnInit, OnDestroy {
	timeZoneOptions: { value: TimeZoneEnum; label: string }[] = [
		{ value: TimeZoneEnum.UTC_TIMEZONE, label: 'UTC' },
		{ value: TimeZoneEnum.ORG_TIMEZONE, label: 'Org Timezone' },
		{ value: TimeZoneEnum.MINE_TIMEZONE, label: 'My Timezone' }
	];
	timeFormatsOptions = DEFAULT_TIME_FORMATS;
	selectedTimeFormat: TimeFormatEnum = TimeFormatEnum.FORMAT_12_HOURS;
	selectedTimeZone: TimeZoneEnum = TimeZoneEnum.UTC_TIMEZONE;

	/*
	 * Getter & Setter
	 */
	private _navigate: boolean = true;
	get navigate(): boolean {
		return this._navigate;
	}
	@Input() set navigate(value: boolean) {
		this._navigate = value;
	}

	@Output() timeZoneChange = new EventEmitter<string>();
	@Output() timeFormatChange = new EventEmitter<TimeFormatEnum>();

	constructor(
		private readonly _route: ActivatedRoute,
		private readonly _router: Router,
		private readonly _store: Store
	) {}

	/**
	 *
	 */
	ngOnInit(): void {
		const storeUser$ = this._store.user$;
		const storeOrganization$ = this._store.selectedOrganization$;
		const storeEmployee$ = this._store.selectedEmployee$;

		/** */
		combineLatest([storeUser$, storeOrganization$])
			.pipe(
				filter(([user, organization]) => !!user && !!organization),
				distinctUntilChange(),
				tap(([user, organization]) => {
					const timeFormat = organization.timeFormat || user.timeFormat;
					this.selectedTimeFormat = timeFormat || TimeFormatEnum.FORMAT_12_HOURS;
				}),
				// Handle component lifecycle to avoid memory leaks
				untilDestroyed(this)
			)
			.subscribe();

		storeEmployee$
			.pipe(
				filter((employee: ISelectedEmployee) => !!employee.id && !!employee.timeFormat),
				tap((employee: ISelectedEmployee) => {
					this.updateSelectedTimeFormat(employee.timeFormat);
				})
			)
			.subscribe();

		// Extract query parameter
		this._route.queryParams
			.pipe(
				tap(({ time_zone, time_format }) => {
					if (time_format) {
						this.selectTimeFormat(time_format);
					}
					if (time_zone) {
						this.selectTimeZone(time_zone);
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Sets the selected time format based on the provided time format.
	 *
	 * @param timeFormat The time format to set.
	 */
	selectTimeFormat(timeFormat: TimeFormatEnum): void {
		const is24Hours = timeFormat == TimeFormatEnum.FORMAT_24_HOURS;
		this.selectedTimeFormat = is24Hours ? TimeFormatEnum.FORMAT_24_HOURS : TimeFormatEnum.FORMAT_12_HOURS;
	}

	/**
	 * Sets the selected timezone based on the provided timezone enum value.
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
	}

	/**
	 * Updates the selected time format and updates the corresponding query parameter.
	 * @param timeFormat The time format to update.
	 */
	async updateSelectedTimeFormat(timeFormat: TimeFormatEnum): Promise<void> {
		// Update the selected time format
		this.selectedTimeFormat = timeFormat;

		if (this.navigate) {
			// Update query parameter 'time_format'
			await this._router.navigate([], {
				relativeTo: this._route,
				queryParams: { time_format: timeFormat.toString() },
				queryParamsHandling: 'merge'
			});
		}

		this.timeFormatChange.emit(this.selectedTimeFormat);
	}

	/**
	 * Updates the selected time zone and updates the corresponding query parameter.
	 * @param timeZone The time zone to update.
	 */
	async updateSelectedTimeZone(timeZone: TimeZoneEnum): Promise<void> {
		// Update the selected time zone
		this.selectedTimeZone = timeZone;

		if (this.navigate) {
			// Update query parameter 'time_zone'
			await this._router.navigate([], {
				relativeTo: this._route,
				queryParams: { time_zone: timeZone.toString() },
				queryParamsHandling: 'merge'
			});
		}

		this.timeZoneChange.emit(this.getTimeZone());
	}

	/**
	 * Retrieves the timezone abbreviation with the region and city for the given zone.
	 * @returns
	 */
	getTimeZoneWithOffset(): string {
		const zone = this.getTimeZone();

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
	 * @returns The time zone string.
	 */
	getTimeZone(): string {
		const defaultTimeZone = 'Etc/UTC';
		let timeZone: string;

		switch (this.selectedTimeZone) {
			case TimeZoneEnum.MINE_TIMEZONE:
				timeZone = this._store.user?.timeZone || defaultTimeZone;
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
	 *
	 */
	ngOnDestroy(): void {}
}
