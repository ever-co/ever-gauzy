import { inject, Injectable, InjectionToken } from '@angular/core';
import { combineLatest, Observable } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, map, shareReplay, tap } from 'rxjs/operators';
import moment from 'moment-timezone';
import {
	ID,
	IDateRangePicker,
	IOrganization,
	IOrganizationProject,
	IOrganizationTeam,
	ISelectedDateRange,
	ISelectedEmployee,
	IUser,
	PermissionsEnum,
	TimeFormatEnum
} from '@gauzy/contracts';
import { IDashboardWidgetContext } from './dashboard-widget-context';
import { Store } from '../store/store.service';
import { DateRangePickerBuilderService } from '../selector-builder/date-range-picker-builder.service';

/**
 * Time zone used when neither the organization nor the user declares one.
 * Matches the default of the timesheet `TimeZoneService`.
 */
export const DEFAULT_DASHBOARD_TIME_ZONE = 'Etc/UTC';

/**
 * Settle window applied to the selector streams before a context is published.
 *
 * Mirrors the debounce the timesheet dashboard pages use, so a burst of
 * selector changes (organization + date range + employee arriving in the same
 * turn) results in ONE context emission instead of five.
 */
const CONTEXT_SETTLE_MS = 300;

/**
 * Minimal shape of the timesheet `TimeZoneService`.
 *
 * The real service lives in `@gauzy/ui-core/shared`, which already depends on
 * `@gauzy/ui-core/core` — importing it here would create a circular secondary
 * entry point and break the library build. The token below is therefore typed
 * structurally so the app can alias it without a code dependency:
 *
 * ```ts
 * { provide: DASHBOARD_TIME_ZONE_SOURCE, useExisting: TimeZoneService }
 * ```
 */
export interface IDashboardTimeZoneSource {
	readonly timeZone$: Observable<string>;
	readonly timeFormat$: Observable<TimeFormatEnum>;
}

/**
 * Optional provider of the user's currently selected time zone / time format.
 *
 * Wiring rule — {@link DashboardContextService} is `providedIn: 'root'`, so it
 * resolves this token in the ROOT injector. A route- or component-level
 * provider is NOT visible to it and would silently do nothing; the alias must
 * be registered in the application-level providers:
 *
 * ```ts
 * { provide: DASHBOARD_TIME_ZONE_SOURCE, useExisting: TimeZoneService }
 * ```
 *
 * `TimeZoneService` is itself a root singleton, so a root alias is correct.
 * Only register it once the dashboard actually renders `<ga-timezone-filter>`:
 * that filter is what pushes a real selection into `TimeZoneService`, and
 * without it the service sits on its `Etc/UTC` construction default and widgets
 * would report different totals than the standard dashboard. When the token is
 * absent, {@link DashboardContextService} instead reproduces the defaults the
 * filter applies on init (organization zone for users who may switch employees,
 * personal zone otherwise), which is the correct answer for a filter-less page.
 */
export const DASHBOARD_TIME_ZONE_SOURCE = new InjectionToken<IDashboardTimeZoneSource>('DASHBOARD_TIME_ZONE_SOURCE');

/**
 * Per-placement narrowing of the ambient dashboard context.
 *
 * A widget can be pinned to one project/team/employee even when the page-level
 * selector says "all".
 */
export interface IDashboardWidgetContextOverrides {
	employeeIds?: ID[];
	projectIds?: ID[];
	teamIds?: ID[];
}

/**
 * Cheap, allocation-light identity of a context.
 *
 * Used for `distinctUntilChanged` and as a cache discriminator. Deliberately
 * NOT `JSON.stringify(context)`: `organization` is a large object whose
 * identity changes on every store write without affecting any statistics query.
 *
 * @param context - The context to fingerprint.
 * @returns A stable string key.
 */
export function dashboardContextKey(context: IDashboardWidgetContext): string {
	return [
		context.tenantId,
		context.organizationId,
		context.startDate?.getTime(),
		context.endDate?.getTime(),
		context.todayStart?.getTime(),
		context.todayEnd?.getTime(),
		context.timeZone,
		context.timeFormat,
		context.currency,
		(context.employeeIds ?? []).join(','),
		(context.projectIds ?? []).join(','),
		(context.teamIds ?? []).join(',')
	].join('|');
}

/**
 * Applies per-placement overrides on top of an ambient context.
 *
 * Only non-empty override arrays win — an empty array means "inherit", which is
 * how a widget with no scope configured keeps following the page selectors.
 *
 * @param context - The ambient context.
 * @param overrides - Placement-level scope, if any.
 * @returns A new context (the input is never mutated).
 */
export function narrowDashboardContext(
	context: IDashboardWidgetContext,
	overrides?: IDashboardWidgetContextOverrides | null
): IDashboardWidgetContext {
	if (!overrides) {
		return context;
	}

	const employeeIds = overrides.employeeIds?.length ? overrides.employeeIds : context.employeeIds;
	const projectIds = overrides.projectIds?.length ? overrides.projectIds : context.projectIds;
	const teamIds = overrides.teamIds?.length ? overrides.teamIds : context.teamIds;

	return {
		...context,
		employeeIds,
		projectIds,
		teamIds,
		// A widget pinned to specific employees is no longer showing the page's
		// selected employee — drop it so widgets can't render a mismatched avatar.
		selectedEmployee: overrides.employeeIds?.length ? undefined : context.selectedEmployee
	};
}

/**
 * Verbatim port of `getAdjustDateRangeFutureAllowed` from
 * `@gauzy/ui-core/shared` (selectors/date-range-picker/date-picker.utils).
 *
 * Duplicated rather than imported because `shared` depends on `core`; see the
 * note on {@link DASHBOARD_TIME_ZONE_SOURCE}. Keep the two in sync — the whole
 * point of this service is that canvas widgets hit the statistics API with
 * byte-identical date bounds to the standard dashboard.
 *
 * @param request - The selected date range.
 * @returns The range adjusted so "today" is never truncated.
 */
function adjustDateRangeFutureAllowed(request: IDateRangePicker): ISelectedDateRange {
	const now = moment();
	let { startDate, endDate } = request;

	// Single day selected: widen to the full day.
	if (moment(moment(startDate).format('YYYY-MM-DD')).isSame(moment(endDate).format('YYYY-MM-DD'))) {
		startDate = moment(startDate).startOf('day').utc().toDate();
		endDate = moment(endDate).endOf('day').utc().toDate();
	}

	// Range ends today: extend to end of day so a running timer is counted.
	if (moment(now.format('YYYY-MM-DD')).isSame(moment(endDate).format('YYYY-MM-DD'))) {
		endDate = moment().endOf('day').utc().toDate();
	}

	return {
		startDate: moment(startDate).toDate(),
		endDate: moment(endDate).toDate()
	} as ISelectedDateRange;
}

/**
 * Single source of truth for "what is the dashboard currently looking at".
 *
 * Canvas widgets are instantiated dynamically and therefore cannot rely on the
 * page-level selector components being their ancestors. This service composes
 * the exact same inputs the timesheet dashboard pages combine
 * (`Store.selectedOrganization$` / `selectedEmployee$` / `selectedProject$` /
 * `selectedTeam$` + `DateRangePickerBuilderService.selectedDateRange$` + the
 * time zone filter) and publishes them as one hot, replayed stream.
 *
 * Nothing is emitted until an organization is selected.
 */
@Injectable({ providedIn: 'root' })
export class DashboardContextService {
	private readonly _store = inject(Store);
	private readonly _dateRangePickerBuilderService = inject(DateRangePickerBuilderService);
	private readonly _timeZoneSource = inject(DASHBOARD_TIME_ZONE_SOURCE, { optional: true });

	/** Last published context, or `null` before the first subscriber. */
	private _snapshot: IDashboardWidgetContext | null = null;

	private readonly _timeZone$: Observable<string> = this._timeZoneSource
		? this._timeZoneSource.timeZone$
		: this._defaultTimeZone$();

	private readonly _timeFormat$: Observable<TimeFormatEnum> = this._timeZoneSource
		? this._timeZoneSource.timeFormat$
		: this._defaultTimeFormat$();

	/**
	 * The reporting window, guaranteed to carry a value.
	 *
	 * `DateRangePickerBuilderService.selectedDateRange$` is a `BehaviorSubject`
	 * seeded with `null` and is only ever written by `<ngx-date-range-picker>`,
	 * which the theme header renders exclusively when the route asks for the date
	 * selector. On a dashboard page WITHOUT that selector the stream would stay
	 * `null` forever, `combineLatest` below would never pass the guard, and every
	 * widget would sit on its loading spinner with no error to show.
	 *
	 * `dates$` is the safe companion: it is seeded with `DEFAULT_DATE_RANGE` (the
	 * current week — exactly what the picker itself defaults to) and the picker
	 * writes it on every selection, so preferring `selectedDateRange$` and only
	 * falling back keeps byte-for-byte parity with the standard dashboard when a
	 * picker is present.
	 */
	private readonly _dateRange$: Observable<IDateRangePicker> = combineLatest([
		this._dateRangePickerBuilderService.selectedDateRange$,
		this._dateRangePickerBuilderService.dates$
	]).pipe(map(([selected, fallback]: [IDateRangePicker | null, IDateRangePicker]) => selected ?? fallback));

	/**
	 * The current dashboard context.
	 *
	 * Hot and replayed (`refCount: false`) so that N widgets subscribing at
	 * different times all observe the same value without re-running the
	 * combination, and a widget added later immediately receives the context.
	 */
	public readonly context$: Observable<IDashboardWidgetContext> = combineLatest([
		this._store.selectedOrganization$,
		this._dateRange$,
		this._store.selectedEmployee$,
		this._store.selectedProject$,
		this._store.selectedTeam$,
		this._timeZone$,
		this._timeFormat$
	]).pipe(
		// Widgets must never query without a scope — an organization-less request
		// would either fail or leak numbers across organizations.
		filter(([organization, dateRange]) => !!organization && !!dateRange),
		debounceTime(CONTEXT_SETTLE_MS),
		map(([organization, dateRange, employee, project, team, timeZone, timeFormat]) =>
			this._buildContext(organization, dateRange, employee, project, team, timeZone, timeFormat)
		),
		distinctUntilChanged((previous, current) => dashboardContextKey(previous) === dashboardContextKey(current)),
		tap((context: IDashboardWidgetContext) => (this._snapshot = context)),
		shareReplay({ bufferSize: 1, refCount: false })
	);

	/**
	 * The most recently published context.
	 *
	 * `null` until `context$` has been subscribed at least once — imperative
	 * callers (e.g. a manual refresh button) should prefer `context$`.
	 */
	public get snapshot(): IDashboardWidgetContext | null {
		return this._snapshot;
	}

	/**
	 * A context stream narrowed by per-placement overrides.
	 *
	 * Intended for the widget host, which provides the result as
	 * `DASHBOARD_WIDGET_CONTEXT` for a single widget instance.
	 *
	 * @param overrides - Placement-level scope; `null`/`undefined` inherits everything.
	 * @returns The narrowed, replayed context stream.
	 */
	public contextFor(overrides?: IDashboardWidgetContextOverrides | null): Observable<IDashboardWidgetContext> {
		if (!overrides) {
			return this.context$;
		}

		return this.context$.pipe(
			map((context: IDashboardWidgetContext) => narrowDashboardContext(context, overrides)),
			distinctUntilChanged((previous, current) => dashboardContextKey(previous) === dashboardContextKey(current)),
			shareReplay({ bufferSize: 1, refCount: true })
		);
	}

	/**
	 * Assembles the context from the raw selector values.
	 *
	 * The date math intentionally mirrors `TimeTrackingComponent.preparePayloads()`
	 * one-for-one: the range goes through {@link adjustDateRangeFutureAllowed} and
	 * "today" is the local day boundary. Both are kept as `Date` here; the
	 * conversion to the API's time-zone-offset string happens once, in the
	 * statistics cache, so every widget sends the same serialized payload.
	 */
	private _buildContext(
		organization: IOrganization,
		dateRange: IDateRangePicker,
		employee: ISelectedEmployee | null,
		project: IOrganizationProject | null,
		team: IOrganizationTeam | null,
		timeZone: string,
		timeFormat: TimeFormatEnum
	): IDashboardWidgetContext {
		const { id: organizationId, tenantId } = organization;
		const { startDate, endDate } = adjustDateRangeFutureAllowed(dateRange);

		return {
			tenantId,
			organizationId,
			organization,
			startDate,
			endDate,
			todayStart: moment().startOf('day').toDate(),
			todayEnd: moment().endOf('day').toDate(),
			timeZone,
			timeFormat,
			currency: organization.currency,
			// `ALL_EMPLOYEES_SELECTED` carries a null id, which must read as "no
			// scope" rather than "the employee whose id is null".
			employeeIds: employee?.id ? [employee.id] : [],
			projectIds: project?.id ? [project.id] : [],
			teamIds: team?.id ? [team.id] : [],
			selectedEmployee: employee ?? undefined
		};
	}

	/**
	 * Fallback time zone stream used when no {@link DASHBOARD_TIME_ZONE_SOURCE}
	 * is provided.
	 *
	 * Reproduces `TimezoneFilterComponent`'s init behaviour: managers see the
	 * organization time zone, everyone else sees their own. Without this a
	 * builder page rendered WITHOUT the timezone filter would silently fall back
	 * to UTC and report different totals than the standard dashboard.
	 *
	 * `userRolePermissions$` is a source (its value is unused) because the branch
	 * below READS the permission set imperatively: right after sign-in or a tenant
	 * switch the permissions resolve AFTER the organization and user have already
	 * emitted, and without this trigger a manager would keep the personal zone
	 * forever — the exact drift this fallback exists to prevent.
	 */
	private _defaultTimeZone$(): Observable<string> {
		return combineLatest([
			this._store.selectedOrganization$,
			this._store.user$,
			this._store.userRolePermissions$
		]).pipe(
			map(([organization, user]: [IOrganization, IUser, unknown]) =>
				this._canChangeSelectedEmployee()
					? organization?.timeZone || DEFAULT_DASHBOARD_TIME_ZONE
					: user?.timeZone || moment.tz.guess()
			),
			distinctUntilChanged()
		);
	}

	/**
	 * Fallback time format stream, normalized exactly like
	 * `TimezoneFilterComponent.selectTimeFormat()` (anything that is not
	 * explicitly 24h is 12h).
	 *
	 * Includes `userRolePermissions$` for the same reason as {@link _defaultTimeZone$}.
	 */
	private _defaultTimeFormat$(): Observable<TimeFormatEnum> {
		return combineLatest([
			this._store.selectedOrganization$,
			this._store.user$,
			this._store.userRolePermissions$
		]).pipe(
			map(([organization, user]: [IOrganization, IUser, unknown]) => {
				const timeFormat = this._canChangeSelectedEmployee() ? organization?.timeFormat : user?.timeFormat;
				return timeFormat === TimeFormatEnum.FORMAT_24_HOURS
					? TimeFormatEnum.FORMAT_24_HOURS
					: TimeFormatEnum.FORMAT_12_HOURS;
			}),
			distinctUntilChanged()
		);
	}

	/** Whether the current user may look at other employees' data. */
	private _canChangeSelectedEmployee(): boolean {
		return this._store.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);
	}
}
