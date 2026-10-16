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
	IURLMetaData
} from '@gauzy/contracts';
import {
	ActivityService,
	DateRangePickerBuilderService,
	EmployeesService,
	Store,
	TimesheetFilterService
} from '@gauzy/ui-core/core';
import { distinctUntilChange, isEmpty, isObject, toLocal } from '@gauzy/ui-core/common';
import { BaseSelectorFilterComponent, GauzyFiltersComponent, TimeZoneService } from '@gauzy/ui-core/shared';

/** How the page lays the period's activity out. */
export type AppUrlView = 'items' | 'members' | 'hours';

/** One app or site over the whole period. */
export interface IActivityItemRow {
	title: string;
	/** First letter of the name, for its icon tile. */
	letter: string;
	duration: number;
	/** Share of the period's total, 0–100. */
	share: number;
	/** Bar length, 0–100, against the most-used row. */
	width: number;
}

/** One member, with the apps or sites they used. */
interface IMemberGroup {
	id: string;
	name: string;
	initials: string;
	avatarUrl?: string;
	duration: number;
	items: IActivityItemRow[];
}

/** One hour (or one day, when the API returns no hour) of activity. */
interface IHourGroup {
	key: string;
	label: string;
	sublabel?: string;
	duration: number;
	items: IActivityItemRow[];
}

/** One page of a visited site, for the expanded URL row. */
interface IPageRow {
	/** The address when one was recorded, else the page's title. */
	label: string;
	/** Set only for a real http(s) address, so the row can link to it. */
	href?: string;
	duration: number;
}

type Loadable<T> = { loading: boolean; failed: boolean; value: T };

/** Rows a member card lists before "Show all". */
const MEMBER_ITEM_LIMIT = 5;

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
	public pages = new Map<string, Loadable<IPageRow[]>>();

	@ViewChild(GauzyFiltersComponent) gauzyFiltersComponent: GauzyFiltersComponent;
	datePickerConfig$: Observable<any> = this.dateRangePickerBuilderService.datePickerConfig$;
	payloads$: BehaviorSubject<ITimeLogFilters> = new BehaviorSubject(null);

	private _employees = new Map<string, { name: string; avatarUrl?: string }>();
	private _employeesFor: string | null = null;
	private _loadSequence = 0;
	private _derived: {
		from: IDailyActivity[];
		search: string;
		sortBy: string;
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
	 * Names and photos for the member view, read once per organization. A user
	 * who may not list employees still sees their own name; anyone else falls
	 * back to a neutral label.
	 */
	private async loadEmployees(): Promise<void> {
		const { id: organizationId, tenantId } = this.organization;
		if (this._employeesFor === organizationId) return;
		this._employeesFor = organizationId;
		this._employees = new Map();

		const user = this.store.user;
		if (user?.employee?.id) {
			this._employees.set(user.employee.id, {
				name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.name || user.email,
				avatarUrl: user.image?.fullUrl || user.imageUrl
			});
		}
		try {
			const { items } = await firstValueFrom(
				this.employeesService.getAll(['user'], { organizationId, tenantId } as any)
			);
			for (const employee of items || []) {
				this._employees.set(employee.id, {
					name: AppUrlActivityComponent.nameOf(employee),
					avatarUrl: employee.user?.image?.fullUrl || employee.user?.imageUrl
				});
			}
		} catch {
			// Without access to the employee list, only the user's own name is known.
		}
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
			const request: IGetActivitiesInput = {
				...this.payloads$.getValue(),
				types: [ActivityType.URL],
				titles: [row.title]
			};
			const activities = await this.activityService.getActivities(request);
			if (sequence !== this._loadSequence || !this.pages.has(row.title)) return;
			this.setPages(row.title, { loading: false, failed: false, value: this.toPages(activities || []) });
		} catch {
			if (sequence !== this._loadSequence || !this.pages.has(row.title)) return;
			this.setPages(row.title, { loading: false, failed: true, value: [] });
		}
	}

	private setPages(title: string, value: Loadable<IPageRow[]>): void {
		const next = new Map(this.pages);
		next.set(title, value);
		this.pages = next;
	}

	/** The site's pages: one row per address, most visited first. */
	private toPages(activities: IActivity[]): IPageRow[] {
		const byUrl = new Map<string, IPageRow>();
		for (const activity of activities) {
			const url = (AppUrlActivityComponent.metaOf(activity).url || '').trim();
			const label = url || activity.description || activity.title;
			const row = byUrl.get(label) || {
				label,
				href: /^https?:\/\//i.test(url) ? url : undefined,
				duration: 0
			};
			row.duration += Number(activity.duration) || 0;
			byUrl.set(label, row);
		}
		return [...byUrl.values()].sort((a, b) => b.duration - a.duration);
	}

	/* ── Derived views ───────────────────────────────────────────────────── */

	/** Every grouping the template reads, computed once per data, search or sort change. */
	private get derived() {
		const from = this.activities;
		const search = this.search.trim().toLowerCase();
		if (this._derived?.from === from && this._derived.search === search && this._derived.sortBy === this.sortBy) {
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
					items: this.rankItems(own, duration)
				};
			})
			.sort((a, b) => b.duration - a.duration || a.name.localeCompare(b.name));

		const hours = this.groupByHour(rows);

		this._derived = {
			from,
			search,
			sortBy: this.sortBy,
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
		const max = Math.max(0, ...byTitle.values());
		const list = [...byTitle.entries()].map(([title, duration]) => ({
			title,
			letter: AppUrlActivityComponent.letterOf(title),
			duration,
			share: total ? (duration / total) * 100 : 0,
			width: max ? Math.max(duration ? 2 : 0, (duration / max) * 100) : 0
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
						? `${group.at.format('LT')} – ${group.at.clone().add(1, 'hour').format('LT')}`
						: undefined,
					duration,
					items: this.rankItems(group.rows, duration)
				};
			});
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

	/** First letter of the name, skipping a leading "www." for a site. */
	private static letterOf(title: string): string {
		const clean = (title || '').replace(/^https?:\/\//i, '').replace(/^www\./i, '');
		const match = clean.match(/[\p{L}\p{N}]/u);
		return match ? match[0].toUpperCase() : '?';
	}

	ngOnDestroy(): void {}
}
