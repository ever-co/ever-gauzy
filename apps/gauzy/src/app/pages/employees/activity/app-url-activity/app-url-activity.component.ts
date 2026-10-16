import { Component, OnInit, OnDestroy, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, filter, firstValueFrom } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import * as moment from 'moment';
import { TranslateService } from '@ngx-translate/core';
import {
	ITimeLogFilters,
	IGetActivitiesInput,
	ActivityType,
	IDailyActivity,
	IActivity,
	IEmployee,
	IURLMetaData,
	TimeFormatEnum
} from '@gauzy/contracts';
import {
	ActivityService,
	DateRangePickerBuilderService,
	EmployeesService,
	Store,
	TimesheetFilterService
} from '@gauzy/ui-core/core';
import { distinctUntilChange, isEmpty, isObject, progressStatus, toLocal, toUTC } from '@gauzy/ui-core/common';
import { BaseSelectorFilterComponent, GauzyFiltersComponent, TimeZoneService } from '@gauzy/ui-core/shared';

/** How the page lays the period's activity out. */
export type AppUrlView = 'items' | 'members' | 'hours';

/** One app or site over the whole period. */
export interface IActivityItemRow {
	title: string;
	/** First letter of the name, for its icon tile. */
	letter: string;
	duration: number;
	/** Share of the period's total, 0–100 — also the bar's length, as on the screenshot cards. */
	share: number;
}

/** One member, with the apps or sites they used. */
interface IMemberGroup {
	id: string;
	name: string;
	initials: string;
	avatarUrl?: string;
	duration: number;
	/** The member's share of everyone's time in the period, 0–100. */
	share: number;
	/** Their apps or sites; each row's share is of the member's own time. */
	items: IActivityItemRow[];
}

/** One app or site in an hour, with the members whose time it adds up. */
interface IHourItemRow extends IActivityItemRow {
	employeeIds: string[];
}

/** One hour (or one day, when the API returns no hour) of activity. */
interface IHourGroup {
	key: string;
	label: string;
	sublabel?: string;
	/** The hour's bounds in UTC, as the activity endpoint reads them; absent for a day without an hour. */
	range?: { startDate: string; endDate: string };
	duration: number;
	items: IHourItemRow[];
}

/** One page of a visited site, for the expanded URL row. */
interface IPageRow {
	/** The site's name, as the old page listed it above each link. */
	title: string;
	/** The address when one was recorded, else the page's description. */
	label: string;
	/** Set only for a real http(s) address, so the row can link to it. */
	href?: string;
	duration: number;
	/** Share of the site's time, 0–100. */
	share: number;
}

type Loadable<T> = { loading: boolean; failed: boolean; value: T };

/** A site's pages, and whether they stop at the read cap rather than at the site's last record. */
type SitePages = Loadable<IPageRow[]> & { truncated?: boolean };

/** Rows a member card lists before "Show all". */
const MEMBER_ITEM_LIMIT = 5;
/** Page size for a site's pages: the endpoint returns only 30 records unless asked for more. */
const PAGES_PAGE_SIZE = 500;
/** Upper bound on the pages read for one site, so a runaway site cannot loop forever. */
const PAGES_MAX_PAGES = 40;

/**
 * Apps / Visited sites, in the manner of Hubstaff's Apps & URLs page: a short
 * summary of the period (total time, how many apps or sites, the most used
 * one), then the activity laid out three ways —
 *
 * - by app or site: one row per name over the whole period, with its share;
 *   a site expands into the pages visited on it;
 * - by member: each member's apps or sites, most used first;
 * - by hour: the hour-by-hour log the page used to show.
 *
 * Every figure comes from the daily activities endpoint for the filters above;
 * the page only groups and ranks them.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-app-url-activity',
	styleUrls: ['./app-url-activity.component.scss'],
	templateUrl: './app-url-activity.component.html',
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false,
	// Not provided in root: the member view reads names and photos through it.
	providers: [EmployeesService]
})
export class AppUrlActivityComponent extends BaseSelectorFilterComponent implements OnInit, OnDestroy {
	filters: ITimeLogFilters = this.request;
	loading: boolean;
	failed = false;
	type: 'apps' | 'urls';

	/** The period's activity as the API returned it, one row per day / hour / name / member. */
	public activities: IDailyActivity[] = [];

	public view: AppUrlView = 'items';
	public readonly views: AppUrlView[] = ['items', 'members', 'hours'];
	public search = '';
	public sortBy: 'time' | 'name' = 'time';
	public readonly memberItemLimit = MEMBER_ITEM_LIMIT;
	/** Member cards opened past their first rows. */
	public expandedMembers = new Set<string>();
	/** Sites opened into their pages, by title. */
	public pages = new Map<string, SitePages>();
	/** Site rows of the by-hour list opened into their pages, by hour and title (`hourPagesKey`). */
	public hourPages = new Map<string, SitePages>();

	@ViewChild(GauzyFiltersComponent) gauzyFiltersComponent: GauzyFiltersComponent;
	datePickerConfig$: Observable<any> = this.dateRangePickerBuilderService.datePickerConfig$;
	payloads$: BehaviorSubject<ITimeLogFilters> = new BehaviorSubject(null);

	private _employees = new Map<string, { name: string; avatarUrl?: string }>();
	/** The organization whose employees were read successfully. */
	private _employeesFor: string | null = null;
	/** The employee read in flight, shared by every activity load of that organization. */
	private _employeesLoad: { organizationId: string; promise: Promise<void> } | null = null;
	private _loadSequence = 0;
	private _derived: {
		from: IDailyActivity[];
		search: string;
		sortBy: string;
		timeFormat: TimeFormatEnum;
		items: IActivityItemRow[];
		members: IMemberGroup[];
		hours: IHourGroup[];
		total: number;
	} | null = null;

	constructor(
		public readonly translateService: TranslateService,
		protected readonly store: Store,
		private readonly activatedRoute: ActivatedRoute,
		private readonly timesheetFilterService: TimesheetFilterService,
		private readonly activityService: ActivityService,
		private readonly employeesService: EmployeesService,
		protected readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		protected readonly timeZoneService: TimeZoneService
	) {
		super(store, translateService, dateRangePickerBuilderService, timeZoneService);
	}

	ngOnInit(): void {
		this.activatedRoute.data
			.pipe(
				tap((params) => (this.type = params.type)),
				untilDestroyed(this)
			)
			.subscribe();
		this.subject$
			.pipe(
				filter(() => !!this.organization),
				tap(() => this.prepareRequest()),
				untilDestroyed(this)
			)
			.subscribe();
		this.payloads$
			.pipe(
				distinctUntilChange(),
				filter((payloads: ITimeLogFilters) => !!payloads),
				tap(() => this.getAppUrlActivityLogs()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Handles changes to the filters.
	 *
	 * @param filters The new filters to apply.
	 */
	filtersChange(filters: ITimeLogFilters): void {
		// Save filters if saveFilters is true
		if (this.gauzyFiltersComponent.saveFilters) {
			this.timesheetFilterService.filter = filters;
		}

		// Update the current filters with a new copy of the filters object
		this.filters = Object.assign({}, filters);

		// Notify subscribers about the filter change
		this.subject$.next(true);
	}

	/**
	 * Prepare Unique Request Always
	 *
	 * @returns
	 */
	prepareRequest() {
		if (isEmpty(this.request) || isEmpty(this.filters)) {
			return;
		}
		const request: IGetActivitiesInput = {
			...this.filters,
			...this.getFilterRequest(this.request),
			types: [this.activityType]
		};
		this.payloads$.next(request);
	}

	get activityType(): ActivityType {
		return this.type === 'urls' ? ActivityType.URL : ActivityType.APP;
	}

	get isUrls(): boolean {
		return this.type === 'urls';
	}

	/* ── Loading ─────────────────────────────────────────────────────────── */

	/**
	 * Get APP & URL's activity logs
	 *
	 * @returns void
	 */
	async getAppUrlActivityLogs(): Promise<void> {
		if (!this.organization || isEmpty(this.request)) {
			return;
		}

		const sequence = ++this._loadSequence;
		this.loading = true;
		this.failed = false;
		this.pages = new Map();
		this.hourPages = new Map();
		this.expandedMembers = new Set();

		try {
			const payloads = this.payloads$.getValue();
			const [activities] = await Promise.all([
				this.activityService.getDailyActivities(payloads),
				this.loadEmployees()
			]);
			if (sequence !== this._loadSequence) return;
			this.activities = (activities || []).map((activity) => ({
				...activity,
				duration: Number(activity.duration) || 0
			}));
		} catch (error) {
			if (sequence !== this._loadSequence) return;
			console.error('Failed to get daily activities:', error);
			this.activities = [];
			this.failed = true;
		} finally {
			if (sequence === this._loadSequence) this.loading = false;
		}
	}

	/**
	 * Names and photos for the member view, read once per organization.
	 *
	 * Every activity load awaits the same read while it is in flight, so none of
	 * them renders before the names arrive. A read only counts as done once it
	 * succeeds: a failed one is tried again on the next load. A user who may not
	 * list employees still sees their own name; anyone else falls back to a
	 * neutral label.
	 */
	private loadEmployees(): Promise<void> {
		const { id: organizationId, tenantId } = this.organization;
		if (this._employeesFor === organizationId) return Promise.resolve();
		if (this._employeesLoad?.organizationId === organizationId) return this._employeesLoad.promise;

		const promise = (async () => {
			const names = new Map<string, { name: string; avatarUrl?: string }>();
			const user = this.store.user;
			if (user?.employee?.id) {
				names.set(user.employee.id, {
					name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.name || user.email,
					avatarUrl: user.image?.fullUrl || user.imageUrl
				});
			}
			let succeeded = false;
			try {
				const { items } = await firstValueFrom(
					this.employeesService.getAll(['user'], { organizationId, tenantId } as any)
				);
				for (const employee of items || []) {
					names.set(employee.id, {
						name: AppUrlActivityComponent.nameOf(employee),
						avatarUrl: employee.user?.image?.fullUrl || employee.user?.imageUrl
					});
				}
				succeeded = true;
			} catch {
				// Without access to the employee list, only the user's own name is known.
			} finally {
				if (this._employeesLoad?.promise === promise) this._employeesLoad = null;
			}
			// Published only while that organization is still the one on screen.
			if (this.organization?.id !== organizationId) return;
			this._employees = names;
			// The map now holds this organization's names (or only the fallback ones),
			// so it is marked loaded for this organization alone, and only on success:
			// a failure clears the mark, so no other organization skips its own read.
			this._employeesFor = succeeded ? organizationId : null;
			// The member groups read these names: rebuild them now they have arrived.
			this._derived = null;
		})();
		this._employeesLoad = { organizationId, promise };
		return promise;
	}

	/**
	 * Opens a site into the pages visited on it over the whole period, or closes
	 * it. The pages are read once per site and filter set.
	 */
	async togglePages(row: IActivityItemRow): Promise<void> {
		if (this.pages.has(row.title)) {
			const next = new Map(this.pages);
			next.delete(row.title);
			this.pages = next;
			return;
		}
		const sequence = this._loadSequence;
		this.setPages(row.title, { loading: true, failed: false, value: [] });
		try {
			const { activities, truncated } = await this.fetchSitePages(row.title);
			if (sequence !== this._loadSequence || !this.pages.has(row.title)) return;
			this.setPages(row.title, { loading: false, failed: false, value: this.toPages(activities), truncated });
		} catch {
			if (sequence !== this._loadSequence || !this.pages.has(row.title)) return;
			this.setPages(row.title, { loading: false, failed: true, value: [] });
		}
	}

	/**
	 * Opens a site row of the by-hour list into the pages visited on it in that
	 * hour by the members the row adds up, or closes it: what each row of the
	 * hour log opened into before the page had other views (one hour, one
	 * member). The by-site table's pages above cover the whole period instead.
	 */
	async toggleHourPages(group: IHourGroup, row: IHourItemRow): Promise<void> {
		const key = this.hourPagesKey(group, row);
		if (this.hourPages.has(key)) {
			const next = new Map(this.hourPages);
			next.delete(key);
			this.hourPages = next;
			return;
		}
		if (!group.range) return;
		const sequence = this._loadSequence;
		this.setHourPages(key, { loading: true, failed: false, value: [] });
		try {
			// Every daily row names its member; an empty list would widen the read to everyone, so it is not sent.
			const { activities, truncated } = await this.fetchSitePages(row.title, {
				...group.range,
				...(row.employeeIds.length ? { employeeIds: row.employeeIds } : {})
			});
			if (sequence !== this._loadSequence || !this.hourPages.has(key)) return;
			this.setHourPages(key, { loading: false, failed: false, value: this.toPages(activities), truncated });
		} catch {
			if (sequence !== this._loadSequence || !this.hourPages.has(key)) return;
			this.setHourPages(key, { loading: false, failed: true, value: [] });
		}
	}

	/** The key a by-hour site row's pages are kept under. */
	hourPagesKey(group: IHourGroup, row: IActivityItemRow): string {
		return `${group.key}|${row.title}`;
	}

	/**
	 * Every activity record of one site over the period. The endpoint returns its
	 * first 30 records unless paged, so the pages are read until one comes back
	 * short: the breakdown and its percentages then cover the same time as the
	 * site's total.
	 *
	 * `scope` narrows the read, e.g. to one hour and its members for the by-hour list.
	 *
	 * `truncated` is set when the read stops at the cap with a full last page —
	 * there may be more records, so the breakdown is partial and says so.
	 */
	private async fetchSitePages(
		title: string,
		scope: Partial<IGetActivitiesInput> = {}
	): Promise<{ activities: IActivity[]; truncated: boolean }> {
		const all: IActivity[] = [];
		for (let page = 0; page < PAGES_MAX_PAGES; page++) {
			const request: IGetActivitiesInput = {
				...this.payloads$.getValue(),
				...scope,
				types: [ActivityType.URL],
				titles: [title],
				limit: PAGES_PAGE_SIZE,
				page
			};
			const batch = (await this.activityService.getActivities(request)) || [];
			all.push(...batch);
			if (batch.length < PAGES_PAGE_SIZE) return { activities: all, truncated: false };
		}
		return { activities: all, truncated: true };
	}

	private setPages(title: string, value: SitePages): void {
		const next = new Map(this.pages);
		next.set(title, value);
		this.pages = next;
	}

	private setHourPages(key: string, value: SitePages): void {
		const next = new Map(this.hourPages);
		next.set(key, value);
		this.hourPages = next;
	}

	/** The site's pages: one row per address, most visited first. */
	private toPages(activities: IActivity[]): IPageRow[] {
		const byUrl = new Map<string, IPageRow>();
		for (const activity of activities) {
			const url = (AppUrlActivityComponent.metaOf(activity).url || '').trim();
			const label = url || activity.description || activity.title;
			const row = byUrl.get(label) || {
				title: activity.title,
				label,
				href: /^https?:\/\//i.test(url) ? url : undefined,
				duration: 0,
				share: 0
			};
			row.duration += Number(activity.duration) || 0;
			byUrl.set(label, row);
		}
		const rows = [...byUrl.values()];
		const total = rows.reduce((sum, row) => sum + row.duration, 0);
		return rows
			.map((row) => ({ ...row, share: total ? (row.duration / total) * 100 : 0 }))
			.sort((a, b) => b.duration - a.duration);
	}

	/* ── Derived views ───────────────────────────────────────────────────── */

	/** Every grouping the template reads, computed once per data, search or sort change. */
	private get derived() {
		const from = this.activities;
		const search = this.search.trim().toLowerCase();
		const timeFormat = this.timeFormat;
		if (
			this._derived?.from === from &&
			this._derived.search === search &&
			this._derived.sortBy === this.sortBy &&
			this._derived.timeFormat === timeFormat
		) {
			return this._derived;
		}

		const rows = search ? from.filter((row) => (row.title || '').toLowerCase().includes(search)) : from;
		const total = rows.reduce((sum, row) => sum + row.duration, 0);
		const memberIds = new Set(rows.map((row) => row.employeeId).filter(Boolean));

		const items = this.rankItems(rows, total);

		const members: IMemberGroup[] = [...memberIds]
			.map((id) => {
				const own = rows.filter((row) => row.employeeId === id);
				const duration = own.reduce((sum, row) => sum + row.duration, 0);
				const person = this._employees.get(id);
				const name = person?.name || this.getTranslation('ACTIVITY.APPS_URLS.UNKNOWN_MEMBER');
				return {
					id,
					name,
					initials: AppUrlActivityComponent.initialsOf(name),
					avatarUrl: person?.avatarUrl,
					duration,
					share: total ? (duration / total) * 100 : 0,
					items: this.rankItems(own, duration)
				};
			})
			.sort((a, b) => b.duration - a.duration || a.name.localeCompare(b.name));

		const hours = this.groupByHour(rows);

		this._derived = {
			from,
			search,
			sortBy: this.sortBy,
			timeFormat,
			items,
			members,
			hours,
			total
		};
		return this._derived;
	}

	get items(): IActivityItemRow[] {
		return this.derived.items;
	}

	get memberGroups(): IMemberGroup[] {
		return this.derived.members;
	}

	get hourGroups(): IHourGroup[] {
		return this.derived.hours;
	}

	get totalDuration(): number {
		return this.derived.total;
	}

	/** The most used app or site, whatever the sort. */
	get topItem(): IActivityItemRow | undefined {
		return this.derived.items.reduce<IActivityItemRow | undefined>(
			(top, row) => (!top || row.duration > top.duration ? row : top),
			undefined
		);
	}

	/** One row per name over a set of activity rows, ranked and sized. */
	private rankItems(rows: IDailyActivity[], total: number): IActivityItemRow[] {
		const byTitle = new Map<string, number>();
		for (const row of rows) {
			const title = row.title || '—';
			byTitle.set(title, (byTitle.get(title) || 0) + row.duration);
		}
		const list = [...byTitle.entries()].map(([title, duration]) => ({
			title,
			letter: AppUrlActivityComponent.letterOf(title),
			duration,
			share: total ? (duration / total) * 100 : 0
		}));
		return this.sortBy === 'name'
			? list.sort((a, b) => a.title.localeCompare(b.title))
			: list.sort((a, b) => b.duration - a.duration || a.title.localeCompare(b.title));
	}

	/**
	 * Rows grouped by the hour they happened in, newest first. The hour is read
	 * in the viewer's zone, as before; a row without an hour falls into its day.
	 */
	private groupByHour(rows: IDailyActivity[]): IHourGroup[] {
		// The clock the filters (or the organization) are set to, as the old dateTimeFormat pipe used.
		const clock = this.timeFormat === TimeFormatEnum.FORMAT_24_HOURS ? 'HH:mm' : 'hh:mm A';
		const groups = new Map<string, { at: moment.Moment; hasHour: boolean; rows: IDailyActivity[] }>();
		for (const row of rows) {
			const day = moment.utc(row.date).format('YYYY-MM-DD');
			const hasHour = !!row.time;
			const at = hasHour ? toLocal(moment.utc(`${day} ${row.time}`)) : moment(day);
			const key = hasHour ? at.format('YYYY-MM-DD HH') : day;
			const group = groups.get(key) || { at, hasHour, rows: [] };
			group.rows.push(row);
			groups.set(key, group);
		}
		return [...groups.entries()]
			.sort(([, a], [, b]) => b.at.valueOf() - a.at.valueOf())
			.map(([key, group]) => {
				const duration = group.rows.reduce((sum, row) => sum + row.duration, 0);
				return {
					key,
					label: group.at.format('dddd, ll'),
					sublabel: group.hasHour
						? `${group.at.format(clock)} – ${group.at.clone().add(1, 'hour').format(clock)}`
						: undefined,
					// The hour as the old hour log read a row's pages: its start in UTC, to one hour later.
					range: group.hasHour
						? {
								startDate: toUTC(group.at).format('YYYY-MM-DD HH:mm:ss'),
								endDate: toUTC(group.at).add(1, 'hour').format('YYYY-MM-DD HH:mm:ss')
							}
						: undefined,
					duration,
					items: this.rankItems(group.rows, duration).map((item) => ({
						...item,
						employeeIds: AppUrlActivityComponent.employeesOf(group.rows, item.title)
					}))
				};
			});
	}

	/**
	 * 12- or 24-hour clock: the one picked in the filter row, else the
	 * organization's setting, else 12-hour — the old dateTimeFormat pipe's default.
	 */
	get timeFormat(): TimeFormatEnum {
		return (this.filters?.timeFormat ||
			this.organization?.timeFormat ||
			TimeFormatEnum.FORMAT_12_HOURS) as TimeFormatEnum;
	}

	/* ── View helpers ────────────────────────────────────────────────────── */

	setView(view: AppUrlView): void {
		this.view = view;
	}

	toggleSort(): void {
		this.sortBy = this.sortBy === 'time' ? 'name' : 'time';
	}

	toggleMember(id: string): void {
		const next = new Set(this.expandedMembers);
		next.has(id) ? next.delete(id) : next.add(id);
		this.expandedMembers = next;
	}

	visibleMemberItems(group: IMemberGroup): IActivityItemRow[] {
		return this.expandedMembers.has(group.id) ? group.items : group.items.slice(0, MEMBER_ITEM_LIMIT);
	}

	/** Seconds as "5h 07m" — the unit every time figure on the page is read in. */
	formatDuration(seconds: number): string {
		const total = Math.max(0, Math.round(Number(seconds) || 0));
		const h = Math.floor(total / 3600);
		const m = Math.floor((total % 3600) / 60);
		if (!h && !m && total) return `${total}s`;
		return `${h}h ${m.toString().padStart(2, '0')}m`;
	}

	/**
	 * A bar's colour from its percentage — the same scale as the screenshot
	 * cards' activity bars (danger, warning, info, success).
	 */
	barStatus(value: number): string {
		return progressStatus(Math.round(Number(value) || 0));
	}

	formatPercent(value: number): string {
		const rounded = Math.round((Number(value) || 0) * 10) / 10;
		return `${rounded < 10 && rounded % 1 ? rounded.toFixed(1) : Math.round(rounded)}%`;
	}

	/* ── Helpers ─────────────────────────────────────────────────────────── */

	private static metaOf(activity: IActivity): IURLMetaData {
		if (!activity.metaData) return {};
		if (typeof activity.metaData === 'string') {
			try {
				return JSON.parse(activity.metaData) as IURLMetaData;
			} catch {
				return {};
			}
		}
		return isObject(activity.metaData) ? (activity.metaData as IURLMetaData) : {};
	}

	private static nameOf(employee: IEmployee): string {
		const user = employee?.user;
		const parts = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
		return employee?.fullName || user?.name || parts || user?.email || '';
	}

	private static initialsOf(name: string): string {
		return (name || '')
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0].toUpperCase())
			.join('');
	}

	/** The members whose rows add up to one name's time, as `rankItems` groups names. */
	private static employeesOf(rows: IDailyActivity[], title: string): string[] {
		return [
			...new Set(
				rows
					.filter((row) => (row.title || '—') === title)
					.map((row) => row.employeeId)
					.filter(Boolean)
			)
		];
	}

	/** First letter of the name, skipping a leading "www." for a site. */
	private static letterOf(title: string): string {
		const clean = (title || '').replace(/^https?:\/\//i, '').replace(/^www\./i, '');
		const match = clean.match(/[\p{L}\p{N}]/u);
		return match ? match[0].toUpperCase() : '?';
	}

	ngOnDestroy(): void {}
}
