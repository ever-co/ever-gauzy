import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivatedRoute, Params } from '@angular/router';
import { combineLatest } from 'rxjs';
import { filter } from 'rxjs/operators';
import { DEFAULT_TIME_FORMATS } from '@gauzy/constants';
import { IOrganization, IUser, PermissionsEnum, TimeFormatEnum, TimeZoneEnum } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { NavigationService, Store } from '@gauzy/ui-core/core';
import { TimeZoneService } from '@gauzy/ui-core/shared';
import { useInjector, useObservable } from '@gauzy/ui-react';
import {
	getTimeZoneWithOffset,
	normalizeTimeFormat,
	normalizeTimeZoneOption,
	resolveMomentTimezone
} from '../utils/timezone.utils';

/** One of the three zone choices of the filter. */
export interface TimeZoneOption {
	value: TimeZoneEnum;
	/** i18n key of the label. */
	labelKey: string;
}

/** The three options, in the Angular order (`TimezoneFilterComponent.timeZoneOptions`). */
export const TIME_ZONE_OPTIONS: readonly TimeZoneOption[] = [
	{ value: TimeZoneEnum.UTC_TIMEZONE, labelKey: 'TIMESHEET.TIME_ZONE_OPTION.UTC' },
	{ value: TimeZoneEnum.ORG_TIMEZONE, labelKey: 'TIMESHEET.TIME_ZONE_OPTION.ORG_TIMEZONE' },
	{ value: TimeZoneEnum.MINE_TIMEZONE, labelKey: 'TIMESHEET.TIME_ZONE_OPTION.MY_TIMEZONE' }
];

export interface TimezoneFilterState {
	selectedTimeZone: TimeZoneEnum;
	selectedTimeFormat: TimeFormatEnum;
	/** The IANA zone currently pushed into `TimeZoneService` (what the button label shows). */
	currentTimeZone: string;
	/** "BST: Europe - Isle of Man" — Angular `getTimeZoneWithOffset()`. */
	timeZoneLabel: string;
	timeZoneOptions: readonly TimeZoneOption[];
	timeFormatOptions: readonly number[];
	/** User picked a zone: applies it AND persists `?time_zone=` (Angular `updateSelectedTimeZone`). */
	updateSelectedTimeZone: (zone: TimeZoneEnum) => Promise<void>;
	/** User picked a format: applies it AND persists `?time_format=` (Angular `updateSelectedTimeFormat`). */
	updateSelectedTimeFormat: (format: TimeFormatEnum) => Promise<void>;
}

/**
 * State + effects of `ga-timezone-filter`, ported 1:1 from `TimezoneFilterComponent`.
 *
 * - Bootstraps from the route's `time_zone` / `time_format` query params, else from the
 *   organization (users who may switch employees) or the user's own settings.
 * - Every selection is pushed into the shared `TimeZoneService` (`setTimeZone` / `setTimeFormat`)
 *   so screenshots, the gallery and the payload agree, and persisted as query params through
 *   `NavigationService.updateQueryParams` — nothing is written to the server, exactly like Angular.
 */
export function useTimezoneFilter(): TimezoneFilterState {
	const injector = useInjector();
	const store = useMemo(() => injector.get(Store), [injector]);
	const route = useMemo(() => injector.get(ActivatedRoute), [injector]);
	const navigationService = useMemo(() => injector.get(NavigationService), [injector]);
	const timeZoneService = useMemo(() => injector.get(TimeZoneService), [injector]);

	const [selectedTimeZone, setSelectedTimeZone] = useState<TimeZoneEnum>(TimeZoneEnum.UTC_TIMEZONE);
	const [selectedTimeFormat, setSelectedTimeFormat] = useState<TimeFormatEnum>(TimeFormatEnum.FORMAT_12_HOURS);
	const currentTimeZone = useObservable(
		useMemo(() => timeZoneService.timeZone$, [timeZoneService]),
		timeZoneService.currentTimeZone
	) as string;

	/** Angular `selectTimeFormat`. */
	const selectTimeFormat = useCallback(
		(timeFormat: unknown) => {
			const normalized = normalizeTimeFormat(timeFormat);
			setSelectedTimeFormat(normalized);
			timeZoneService.setTimeFormat(normalized);
		},
		[timeZoneService]
	);

	/** Angular `selectTimeZone`. */
	const selectTimeZone = useCallback(
		(timeZone: unknown) => {
			const normalized = normalizeTimeZoneOption(timeZone);
			setSelectedTimeZone(normalized);
			timeZoneService.setTimeZone(
				resolveMomentTimezone(normalized, {
					userTimeZone: store.user?.timeZone,
					organizationTimeZone: store.selectedOrganization?.timeZone
				})
			);
		},
		[timeZoneService, store]
	);

	// Angular `ngOnInit` (org-driven defaults for users who may switch employees) and
	// `ngAfterViewInit` (user-driven defaults for everyone else), both re-run on query-param changes.
	useEffect(() => {
		const queryParams$ = route.queryParams.pipe(
			filter((params: Params) => !!params),
			distinctUntilChange()
		);
		const hasChangeSelectedEmployeePermission = () => store.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);
		const applyTimeFormat = (queryParams: Params, fallback: unknown) => {
			const { time_format } = queryParams;
			selectTimeFormat(time_format ? parseInt(time_format, 10) : fallback);
		};
		const applyTimeZone = (queryParams: Params, fallback: TimeZoneEnum) => {
			const { time_zone } = queryParams;
			selectTimeZone(time_zone ? time_zone : fallback);
		};

		const organizationSubscription = combineLatest([
			queryParams$,
			store.selectedOrganization$.pipe(
				filter((organization: IOrganization) => !!organization),
				filter(() => hasChangeSelectedEmployeePermission()),
				distinctUntilChange()
			)
		]).subscribe(([queryParams, organization]) => {
			applyTimeFormat(queryParams, (organization as IOrganization).timeFormat);
			applyTimeZone(queryParams, TimeZoneEnum.ORG_TIMEZONE);
		});

		const userSubscription = combineLatest([
			queryParams$,
			store.user$.pipe(
				filter((user: IUser) => !!user),
				filter(() => !hasChangeSelectedEmployeePermission())
			)
		])
			.pipe(distinctUntilChange())
			.subscribe(([queryParams, user]) => {
				applyTimeFormat(queryParams, (user as IUser).timeFormat);
				applyTimeZone(queryParams, TimeZoneEnum.MINE_TIMEZONE);
			});

		return () => {
			organizationSubscription.unsubscribe();
			userSubscription.unsubscribe();
		};
	}, [route, store, selectTimeFormat, selectTimeZone]);

	const updateSelectedTimeFormat = useCallback(
		async (timeFormat: TimeFormatEnum) => {
			selectTimeFormat(timeFormat);
			await navigationService.updateQueryParams({ time_format: timeFormat.toString() });
		},
		[selectTimeFormat, navigationService]
	);

	const updateSelectedTimeZone = useCallback(
		async (timeZone: TimeZoneEnum) => {
			selectTimeZone(timeZone);
			await navigationService.updateQueryParams({ time_zone: timeZone.toString() });
		},
		[selectTimeZone, navigationService]
	);

	const timeZoneLabel = useMemo(() => getTimeZoneWithOffset(currentTimeZone), [currentTimeZone]);

	return {
		selectedTimeZone,
		selectedTimeFormat,
		currentTimeZone,
		timeZoneLabel,
		timeZoneOptions: TIME_ZONE_OPTIONS,
		timeFormatOptions: DEFAULT_TIME_FORMATS,
		updateSelectedTimeZone,
		updateSelectedTimeFormat
	};
}
