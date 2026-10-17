import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, combineLatest, firstValueFrom, timer } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, map, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import * as moment from 'moment-timezone';
import {
	BaseEntityEnum,
	IActivitiesStatistics,
	ICountsStatistics,
	IEmployee,
	IMembersStatistics,
	IOrganization,
	IOrganizationProject,
	IOrganizationTeam,
	IOrganizationTeamEmployee,
	IPagination,
	IProjectsStatistics,
	ITask,
	ITasksStatistics,
	ITimeLogFilters,
	ITimeLogTodayFilters,
	OrganizationProjectBudgetTypeEnum,
	PermissionsEnum,
	ProjectStatusEnum,
	RolesEnum,
	TaskStatusEnum,
	TimeLogType
} from '@gauzy/contracts';
import { API_PREFIX, toParams, toUtcOffset } from '@gauzy/ui-core/common';
import {
	OrganizationProjectsService,
	OrganizationTeamsService,
	Store,
	TasksService,
	TimesheetService,
	TimesheetStatisticsService
} from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { HashNumberPipe, IRecordViewSection, IRecordViewStatus, TimeZoneService } from '@gauzy/ui-core/shared';
import { IEmployeeHoursDay } from '../../employees/view-employee/employee-hours-chart/employee-hours-chart.component';
import { AssigneePopoverKeyboard } from '../../employees/view-employee/assignee-popover-keyboard';
import {
	buildTaskViewSections,
	isTaskFinished,
	taskStatusOf,
	TASK_VIEW_RELATIONS
} from '../../tasks/components/task-view/task-view-sections';
import { buildProjectViewSections, PROJECT_VIEW_RELATIONS, projectStatusOf } from './project-view-sections';

/** The date windows the overview can be read over — the same as an employee's page. */
export enum TeamViewPeriod {
	THIS_WEEK = 'THIS_WEEK',
	THIS_MONTH = 'THIS_MONTH',
	LAST_30_DAYS = 'LAST_30_DAYS'
}

export type TeamViewTab = 'overview' | 'members' | 'details';

type PageState = 'loading' | 'ready' | 'not-found' | 'error';

type Presence = 'tracking' | 'online' | 'away' | 'offline';

/** One member of the team, with their period figures once the statistics land. */
interface IMemberRow {
	id: string;
	name: string;
	initials: string;
	avatarUrl?: string;
	email?: string;
	position?: string;
	isManager: boolean;
	isTrackingEnabled: boolean;
	presence: Presence;
	activeTask?: string;
	order: number;
}

/** One row of a ranked table (members, projects, tasks, apps): a name and its time in the period. */
interface IRankedRow {
	id: string;
	name: string;
	meta?: string;
	duration: number;
	/** Share of the period's total, 0–100. */
	share: number;
	/** Bar length, 0–100, relative to the largest row. */
	width: number;
}

/** One project on the Overview: the team's project and its time in the period. */
interface IProjectOverviewRow {
	id: string;
	name: string;
	imageUrl?: string;
	initials: string;
	duration: number;
	share: number;
	width: number;
	/** False for a project the members worked on that is not linked to the team. */
	linked: boolean;
}

/** A project's task completion: done, in progress and still to do, out of all its tasks. */
interface IProjectProgress {
	total: number;
	done: number;
	progress: number;
	todo: number;
	/** Done share of all tasks, 0–100. */
	percent: number;
}

/** The project quick look's headline: its status line and key figures. */
interface IProjectFacts {
	status: IRecordViewStatus | null;
	isPublic?: boolean;
	client?: string;
	/** Null until the project's full read lands. */
	members: number | null;
	endDate?: string;
	due: { key: string; count?: number } | null;
	overdue: boolean;
}

/** One person in a project's "who worked the most": their photo, time, share and activity. */
interface IContributorRow extends IRankedRow {
	initials: string;
	avatarUrl?: string;
	/** Average activity in the period, 0–100; absent when unknown. */
	activity?: number;
	/** Live presence, for the "tracking now" dot. */
	presence?: Presence;
}

/** An open task of the project that is overdue or due within {@link ATTENTION_DAYS} days. */
interface IAttentionTask {
	id: string;
	title: string;
	due: { key: string; count?: number };
	overdue: boolean;
}

/** A project's hours budget against the hours worked on it since it started. */
interface IProjectBudget {
	usedHours: number;
	budgetHours: number;
	/** Used share of the budget, 0–100 (capped for the bar; `over` says when it is exceeded). */
	percent: number;
	over: boolean;
	/** Amber from 80% used. */
	warning: boolean;
}

/** Rows the project drawer's task list shows before "Show all". */
const PROJECT_TASK_LIMIT = 6;

/** Tasks due within this many days count as due soon. */
const ATTENTION_DAYS = 3;

/** A member's period figures, keyed by employee id. */
interface IMemberFigures {
	duration: number;
	activity: number;
	today: number;
}

/** An assignee, as their avatar and its hover card show them. */
interface ITaskPerson {
	id: string;
	name: string;
	initials: string;
	avatarUrl?: string;
	email?: string;
	/** Live presence, as the dot on the card's photo and the line under the name. */
	presence: 'tracking' | 'online' | 'away' | 'offline';
	/** Their short description, from the profile. */
	bio?: string;
	/** "Oct 12, 2025": when they started working, if set. */
	since?: string;
}

/** A team task as the Team tasks panel lists it. */
interface ITeamTaskRow {
	/** The task as the list loaded it — what the quick look opens with before its full read lands. */
	task: ITask;
	id: string;
	key: string;
	title: string;
	project?: string;
	status: string;
	statusGroup: 'todo' | 'progress' | 'blocked' | 'done';
	dueDate?: string;
	due: { key: string; count?: number };
	dueTime: number;
	doneTime: number;
	overdue: boolean;
	priority?: string;
	priorityLevel?: 'urgent' | 'high' | 'medium' | 'low';
	/** Assignees as avatars; the first few are drawn, the rest counted. */
	people: ITaskPerson[];
	/** The assignees behind the "+N" avatar, listed when it is hovered. */
	morePeople: ITaskPerson[];
	/** The due date written out in full (weekday included), for its tooltip. */
	dueDateLong?: string;
}

export type TaskFilter = 'open' | 'progress' | 'overdue' | 'done';

interface IDelta {
	percent: number | null;
	direction: 'up' | 'down' | 'flat';
}

/** One label/value line on the Details tab. */
interface IDetailField {
	label: string;
	value?: string;
	href?: string;
	swatch?: string;
}

/** Each request lands or fails on its own; a failure (most often a 403) only blanks its panel. */
type Loadable<T> = { loading: boolean; failed: boolean; value: T };

const Loadable = {
	empty<T>(value: T): Loadable<T> {
		return { loading: true, failed: false, value };
	}
};

type PanelKey = 'counts' | 'previousCounts' | 'hours' | 'memberStats' | 'projectStats' | 'topTasks' | 'apps' | 'tasks';

const CLOSED_STATUSES = new Set<string>([TaskStatusEnum.DONE, TaskStatusEnum.COMPLETED, TaskStatusEnum.CANCELLED]);
const PRIORITY_LEVELS = new Set<string>(['urgent', 'high', 'medium', 'low']);
const IN_PROGRESS_STATUSES = new Set<string>([
	TaskStatusEnum.IN_PROGRESS,
	TaskStatusEnum.READY_FOR_REVIEW,
	TaskStatusEnum.IN_REVIEW
]);

/** Everything a team page reads in one request; trimmed to {@link BASE_RELATIONS} if the API refuses a relation. */
const FULL_RELATIONS = [
	'members',
	'members.role',
	'members.employee',
	'members.employee.user',
	'members.employee.organizationPosition',
	'members.activeTask',
	'tags',
	'projects'
];
const BASE_RELATIONS = ['members.role', 'members.employee.user', 'tags', 'projects'];

/** How often member presence and current tasks are re-read while the page is open. */
const PRESENCE_REFRESH_MS = 60_000;
const LIST_LIMIT = 6;
const TASK_LIMIT = 8;

type TaskSummary = { open: number; todo: number; progress: number; blocked: number; overdue: number; done: number };

/**
 * Team page, in the manner of Hubstaff's team view: a header with the team's
 * identity, live presence and key facts, then three tabs —
 *
 * - Overview: the period's time and activity for the whole team against the
 *   previous period, hours per day, time by member, the team's tasks, and
 *   where the time went (projects, tasks, apps);
 * - Members: everyone on the team, with role, presence, current task and their
 *   own figures for the period;
 * - Details: the full read-only team record and its settings.
 *
 * Team figures are the figures of the team's members, so they read the same as
 * the members' own pages. Each panel loads on its own: a missing permission
 * blanks that panel, never the page.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-view-team',
	templateUrl: './view-team.component.html',
	styleUrls: ['../../employees/view-employee/view-employee.component.scss', './view-team.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class ViewTeamComponent extends TranslationBaseComponent implements OnInit {
	public readonly PermissionsEnum = PermissionsEnum;
	public readonly BaseEntityEnum = BaseEntityEnum;
	public readonly periods: TeamViewPeriod[] = Object.values(TeamViewPeriod);

	public state: PageState = 'loading';
	public team: IOrganizationTeam | null = null;
	public members: IMemberRow[] = [];
	public details: { general: IDetailField[]; settings: IDetailField[]; record: IDetailField[] } = {
		general: [],
		settings: [],
		record: []
	};
	public tab: TeamViewTab = 'overview';

	public readonly period$ = new BehaviorSubject<TeamViewPeriod>(TeamViewPeriod.THIS_WEEK);
	public get period(): TeamViewPeriod {
		return this.period$.getValue();
	}
	public set period(value: TeamViewPeriod) {
		this.period$.next(value);
	}

	public counts: Loadable<ICountsStatistics | null> = Loadable.empty(null);
	public previousCounts: Loadable<ICountsStatistics | null> = Loadable.empty(null);
	public hours: Loadable<IEmployeeHoursDay[]> = Loadable.empty([]);
	public memberStats: Loadable<Record<string, IMemberFigures>> = Loadable.empty({});
	public projectStats: Loadable<IRankedRow[]> = Loadable.empty([]);
	public topTasks: Loadable<IRankedRow[]> = Loadable.empty([]);
	public apps: Loadable<IRankedRow[]> = Loadable.empty([]);
	public tasks: Loadable<ITeamTaskRow[]> = Loadable.empty([]);

	public readonly taskFilters: TaskFilter[] = ['open', 'progress', 'overdue', 'done'];
	public taskFilter: TaskFilter = 'open';
	/** The Team tasks panel lists every task of the selected view, not just the first few. */
	public showAllTasks = false;
	public readonly taskLimit = TASK_LIMIT;

	/** The task open in the quick-look drawer, its sections and status lozenge. */
	public viewedTask: ITask | null = null;
	public viewSections: IRecordViewSection[] = [];
	public viewStatus: IRecordViewStatus | null = null;
	/** Keyboard access to the assignee cards and the "+N" list. */
	public readonly assigneeKeyboard = new AssigneePopoverKeyboard();
	private _viewSequence = 0;

	/** The project open in the quick-look drawer, and its sections. */
	public viewedProject: IOrganizationProject | null = null;
	/** The card it was opened from — its logo and initials head the drawer. */
	public viewedProjectCard: IProjectOverviewRow | null = null;
	/** Its task completion, and the team members who worked on it the most in the period. */
	public projectProgress: Loadable<IProjectProgress | null> = Loadable.empty(null);
	public projectContributors: Loadable<IContributorRow[]> = Loadable.empty([]);
	/** Its hours per day in the period, its most worked tasks, what needs attention, and its budget. */
	public projectHours: Loadable<IEmployeeHoursDay[]> = Loadable.empty([]);
	public projectTopTasks: Loadable<IRankedRow[]> = Loadable.empty([]);
	public projectAttention: IAttentionTask[] = [];
	/** All the project's tasks as list rows, the filter over them, and whether the list is cut. */
	public projectTasks: ITeamTaskRow[] = [];
	public projectTaskFilter: TaskFilter = 'open';
	public showAllProjectTasks = false;
	public readonly projectTaskLimit = PROJECT_TASK_LIMIT;
	public projectBudget: IProjectBudget | null = null;
	public projectSections: IRecordViewSection[] = [];
	public projectFacts: IProjectFacts | null = null;
	private _projectSequence = 0;
	private readonly _hashPipe = new HashNumberPipe();

	private _organization: IOrganization | null = null;
	private _teamId: string | null = null;
	private _loadSequence = 0;
	private _pending: Partial<Record<PanelKey, object>> = {};
	private _taskSummary: { from: ITeamTaskRow[]; value: TaskSummary } | null = null;
	private _projectOverview: {
		from: IRankedRow[];
		team: IOrganizationTeam | null;
		value: IProjectOverviewRow[];
	} | null = null;
	private _memberRanking: { from: Record<string, IMemberFigures>; value: IRankedRow[] } | null = null;

	constructor(
		public readonly translateService: TranslateService,
		private readonly _route: ActivatedRoute,
		private readonly _http: HttpClient,
		private readonly _store: Store,
		private readonly _timeZoneService: TimeZoneService,
		private readonly _teamsService: OrganizationTeamsService,
		private readonly _statisticsService: TimesheetStatisticsService,
		private readonly _timesheetService: TimesheetService,
		private readonly _tasksService: TasksService,
		private readonly _projectsService: OrganizationProjectsService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		// Like the lists, the page belongs to the organization selected in the header:
		// switching it reloads the page, and a team of another organization reads "not found".
		const organization$ = this._store.selectedOrganization$.pipe(
			filter((organization: IOrganization) => !!organization?.id),
			distinctUntilChanged((a: IOrganization, b: IOrganization) => a.id === b.id)
		);
		const id$ = this._route.paramMap.pipe(
			map((params) => params.get('id')),
			filter((id) => !!id),
			distinctUntilChanged()
		);
		combineLatest([id$, organization$])
			.pipe(
				tap(([id, organization]) => {
					this._teamId = id;
					this._organization = organization;
					void this.loadTeam();
				}),
				untilDestroyed(this)
			)
			.subscribe();

		this.period$
			.pipe(
				debounceTime(50),
				filter(() => !!this.team),
				tap(() => this.loadFigures()),
				untilDestroyed(this)
			)
			.subscribe();

		// Presence (tracking / online / away) and current tasks change while the page
		// is open: re-read them every minute while a team is on screen and the tab is visible.
		timer(PRESENCE_REFRESH_MS, PRESENCE_REFRESH_MS)
			.pipe(
				filter(() => this.state === 'ready' && !!this.team && document.visibilityState === 'visible'),
				tap(() => void this.refreshPresence()),
				untilDestroyed(this)
			)
			.subscribe();

		this.translateService.onLangChange
			.pipe(
				filter(() => !!this.team),
				tap(() => (this.details = this.buildDetails(this.team))),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/* ── Team ────────────────────────────────────────────────────────────── */

	/** Loads (or reloads, after an error) the team the URL names. */
	async loadTeam(): Promise<void> {
		const id = this._teamId;
		const organization = this._organization;
		if (!id || !organization) return;

		const sequence = ++this._loadSequence;
		// Nothing of the previous team stays on screen: not its open task, not its
		// figures, and no reply still in flight for it may land afterwards.
		this.closeTask();
		this.closeProject();
		this.resetPanels();
		this.state = 'loading';
		this.team = null;
		this.members = [];

		try {
			const { team } = await this.fetchTeam(id, organization);
			if (sequence !== this._loadSequence) return;
			if (
				!team ||
				String(team.id) !== String(id) ||
				(team.organizationId && team.organizationId !== organization.id)
			) {
				this.state = 'not-found';
				return;
			}
			this.team = team;
			this.members = this.buildMembers(team.members || []);
			this.details = this.buildDetails(team);
			this.state = 'ready';
			this.loadFigures();
		} catch (error) {
			if (sequence !== this._loadSequence) return;
			this.state = error?.status === 404 || error?.status === 403 ? 'not-found' : 'error';
		}
	}

	/**
	 * Empties every panel and forgets the requests in flight, so a reply for the
	 * previous team is dropped by `track()` rather than painted over this one.
	 */
	private resetPanels(): void {
		this._pending = {};
		this.counts = Loadable.empty(null);
		this.previousCounts = Loadable.empty(null);
		this.hours = Loadable.empty([]);
		this.memberStats = Loadable.empty({});
		this.projectStats = Loadable.empty([]);
		this.topTasks = Loadable.empty([]);
		this.apps = Loadable.empty([]);
		this.tasks = Loadable.empty([]);
		this.taskFilter = 'open';
		this.showAllTasks = false;
	}

	/**
	 * The team with every relation the page reads; the base relations alone if the API refuses one.
	 * `full` says which it was: only a full read carries the members' current tasks.
	 */
	private async fetchTeam(
		id: string,
		organization: IOrganization
	): Promise<{ team: IOrganizationTeam | null; full: boolean }> {
		const where = { id, organizationId: organization.id, tenantId: organization.tenantId } as any;
		const pick = (result: IPagination<IOrganizationTeam>) => result?.items?.find((item) => item.id === id) ?? null;
		try {
			return { team: pick(await this._teamsService.getAll(FULL_RELATIONS, where)), full: true };
		} catch (error) {
			if (error?.status === 403 || error?.status === 404) throw error;
			return { team: pick(await this._teamsService.getAll(BASE_RELATIONS, where)), full: false };
		}
	}

	/**
	 * Re-reads the team's members and updates only what goes stale on an open
	 * page — presence and current task. The rest of the page is left as it is,
	 * and a failed read keeps the last known state.
	 */
	private async refreshPresence(): Promise<void> {
		const team = this.team;
		const organization = this._organization;
		const sequence = this._loadSequence;
		if (!team || !organization) return;
		try {
			const { team: fresh, full } = await this.fetchTeam(team.id, organization);
			// Another team (or organization) was loaded meanwhile: this read is not for it.
			if (sequence !== this._loadSequence || !fresh) return;
			const latest = new Map(this.buildMembers(fresh.members || []).map((member) => [member.id, member]));
			this.members = this.members.map((member) => {
				const update = latest.get(member.id);
				if (!update) return member;
				// A base-relation read has no current tasks: keep the ones on screen rather
				// than clearing them; only a full read may say a member has none.
				return {
					...member,
					presence: update.presence,
					activeTask: full ? update.activeTask : member.activeTask
				};
			});
		} catch {
			// Keep the last known presence.
		}
	}

	/* ── Header ──────────────────────────────────────────────────────────── */

	get logoUrl(): string | undefined {
		return this.team?.image?.fullUrl || this.team?.image?.url || this.team?.logo || undefined;
	}

	get initials(): string {
		return ViewTeamComponent.initialsOf(this.team?.name || '');
	}

	get managers(): IMemberRow[] {
		return this.members.filter((member) => member.isManager);
	}

	get trackingNow(): number {
		return this.members.filter((member) => member.presence === 'tracking').length;
	}

	get onlineNow(): number {
		return this.members.filter((member) => member.presence !== 'offline').length;
	}

	get trackingEnabledCount(): number {
		return this.members.filter((member) => member.isTrackingEnabled).length;
	}

	get createdOn(): string | undefined {
		return this.team?.createdAt ? moment(this.team.createdAt).format('ll') : undefined;
	}

	/** "3 months" since the team was created. */
	get age(): string | undefined {
		return this.team?.createdAt
			? moment.duration(moment().diff(moment(this.team.createdAt))).humanize()
			: undefined;
	}

	get tags(): { name?: string; color?: string }[] {
		return (this.team?.tags || []).filter((tag) => !!tag?.name);
	}

	get projects(): { id: string; name: string; imageUrl?: string; initials: string }[] {
		return (this.team?.projects || [])
			.filter((project) => !!project?.name)
			.map((project) => ({
				id: project.id,
				name: project.name,
				imageUrl: project.imageUrl || (project as any).image?.fullUrl,
				initials: ViewTeamComponent.initialsOf(project.name)
			}));
	}

	/**
	 * The Overview's Projects panel: every project linked to the team, with the
	 * time its members worked on it in the period, plus any project they worked
	 * on that is not linked to the team (flagged as such). Most worked first;
	 * projects with no time keep their place at the end so the list stays whole.
	 */
	get projectOverview(): IProjectOverviewRow[] {
		const stats = this.projectStats.value || [];
		const team = this.team;
		if (this._projectOverview?.from !== stats || this._projectOverview?.team !== team) {
			const time = new Map(stats.map((row) => [row.id, row.duration]));
			const linked = this.projects.map((project) => ({
				...project,
				duration: time.get(project.id) || 0,
				linked: true
			}));
			const linkedIds = new Set(linked.map((project) => project.id));
			const others = stats
				.filter((row) => !linkedIds.has(row.id))
				.map((row) => ({
					id: row.id,
					name: row.name,
					imageUrl: undefined,
					initials: ViewTeamComponent.initialsOf(row.name),
					duration: row.duration,
					linked: false
				}));
			const all = [...linked, ...others];
			const total = all.reduce((sum, row) => sum + row.duration, 0);
			const max = Math.max(0, ...all.map((row) => row.duration));
			const value = all
				.map((row) => ({
					...row,
					share: total ? (row.duration / total) * 100 : 0,
					width: max ? Math.max(row.duration ? 2 : 0, (row.duration / max) * 100) : 0
				}))
				.sort((a, b) => b.duration - a.duration || a.name.localeCompare(b.name));
			this._projectOverview = { from: stats, team, value };
		}
		return this._projectOverview.value;
	}

	/* ── Members ─────────────────────────────────────────────────────────── */

	/**
	 * Managers first, then by the team's own order, then by name. A member is a
	 * manager when the membership says so or carries the Manager role — older
	 * teams only set the role.
	 */
	private buildMembers(members: IOrganizationTeamEmployee[]): IMemberRow[] {
		return members
			.filter((member) => !!member?.employee)
			.map((member) => {
				const employee = member.employee as IEmployee;
				const name = ViewTeamComponent.nameOf(employee);
				return {
					id: employee.id,
					name,
					initials: ViewTeamComponent.initialsOf(name),
					avatarUrl: employee.user?.image?.fullUrl || employee.user?.imageUrl || undefined,
					email: employee.user?.email,
					position: employee.organizationPosition?.name,
					isManager: !!member.isManager || member.role?.name === RolesEnum.MANAGER,
					isTrackingEnabled: member.isTrackingEnabled !== false,
					presence: ViewTeamComponent.presenceOf(employee),
					activeTask: member.activeTask?.title,
					order: Number(member.order) || 0
				} as IMemberRow;
			})
			.sort(
				(a, b) => Number(b.isManager) - Number(a.isManager) || a.order - b.order || a.name.localeCompare(b.name)
			);
	}

	/** A member's figures for the period, once the member statistics land. */
	figuresOf(member: IMemberRow): IMemberFigures | undefined {
		return this.memberStats.value?.[member.id];
	}

	/** Time by member, ranked, every member who worked in the period. */
	get memberRanking(): IRankedRow[] {
		const stats = this.memberStats.value || {};
		if (this._memberRanking?.from !== stats) {
			const rows = this.members.map((member) => ({
				id: member.id,
				name: member.name,
				meta: stats[member.id] ? this.formatPercent(stats[member.id].activity) : undefined,
				duration: stats[member.id]?.duration || 0
			}));
			this._memberRanking = { from: stats, value: this.rank(rows, (row) => row) };
		}
		return this._memberRanking.value;
	}

	/** How many members tracked any time in the period. */
	get activeMembers(): number {
		const stats = this.memberStats.value || {};
		return this.members.filter((member) => (stats[member.id]?.duration || 0) > 0).length;
	}

	/* ── Period ─────────────────────────────────────────────────────────── */

	get rangeLabel(): string {
		const { start, end } = this.periodRange();
		const sameYear = start.year() === end.year();
		return `${start.format(sameYear ? 'MMM D' : 'll')} – ${end.format('ll')}`;
	}

	private periodRange(): { start: moment.Moment; end: moment.Moment } {
		switch (this.period) {
			case TeamViewPeriod.THIS_MONTH:
				return { start: moment().startOf('month'), end: moment().endOf('month') };
			case TeamViewPeriod.LAST_30_DAYS:
				return { start: moment().subtract(29, 'days').startOf('day'), end: moment().endOf('day') };
			case TeamViewPeriod.THIS_WEEK:
			default:
				return { start: moment().startOf('week'), end: moment().endOf('week') };
		}
	}

	/** The same span one period earlier, cut at the same point in time. */
	private previousRange(): { start: moment.Moment; end: moment.Moment } {
		const { start, end } = this.periodRange();
		const cut = moment.min(end, moment());
		const shift = (date: moment.Moment) => {
			switch (this.period) {
				case TeamViewPeriod.THIS_MONTH:
					return date.clone().subtract(1, 'month');
				case TeamViewPeriod.LAST_30_DAYS:
					return date.clone().subtract(30, 'days');
				case TeamViewPeriod.THIS_WEEK:
				default:
					return date.clone().subtract(1, 'week');
			}
		};
		return { start: shift(start), end: shift(cut) };
	}

	/* ── Figures ─────────────────────────────────────────────────────────── */

	formatDuration = (seconds: number): string => {
		const total = Math.max(0, Math.round(Number(seconds) || 0));
		const h = Math.floor(total / 3600);
		const m = Math.floor((total % 3600) / 60);
		return `${h}h ${m.toString().padStart(2, '0')}m`;
	};

	formatHours = (hours: number): string => this.formatDuration((Number(hours) || 0) * 3600);

	formatPercent(value: number | undefined): string {
		return `${Math.round(Number(value) || 0)}%`;
	}

	get durationDelta(): IDelta {
		return ViewTeamComponent.delta(this.counts.value?.weekDuration, this.previousCounts.value?.weekDuration);
	}

	get activityDelta(): IDelta {
		return ViewTeamComponent.delta(this.counts.value?.weekActivities, this.previousCounts.value?.weekActivities);
	}

	private static delta(current: number | undefined, previous: number | undefined): IDelta {
		const now = Number(current) || 0;
		const before = Number(previous) || 0;
		if (!before) return { percent: null, direction: 'flat' };
		const percent = Math.round(((now - before) / before) * 100);
		let direction: IDelta['direction'] = 'flat';
		if (percent > 0) direction = 'up';
		else if (percent < 0) direction = 'down';
		return { percent: Math.abs(percent), direction };
	}

	/** Seconds worked in the period and per working day, for the chart's caption. */
	get hoursSummary(): { total: number; average: number } {
		const days = this.hours.value || [];
		const total = days.reduce((sum, day) => sum + day.tracked + day.manual, 0);
		const worked = days.filter((day) => day.tracked + day.manual > 0).length;
		return { total: total * 3600, average: worked ? (total / worked) * 3600 : 0 };
	}

	/* ── Tasks ───────────────────────────────────────────────────────────── */

	/**
	 * Opens a task in the quick-look drawer — the same sections and header the
	 * task lists show — without leaving the team page. It opens at once with the
	 * row's data, then fills in from the task's full read (status, priority,
	 * size, sprint, description…); a failed read keeps what the row had.
	 */
	async openTask(row: ITeamTaskRow): Promise<void> {
		this.closeProject();
		const sequence = ++this._viewSequence;
		this.showTask(row.task);
		try {
			const task = await this._tasksService.getById(row.id, TASK_VIEW_RELATIONS);
			if (sequence === this._viewSequence && this.viewedTask?.id === row.id && task) {
				this.showTask(task);
			}
		} catch {
			// The row's own data stays on screen.
		}
	}

	closeTask(): void {
		this._viewSequence++;
		this.viewedTask = null;
	}

	/** The task's own full-width page. */
	taskLink(id: string): string[] {
		return ['/pages/tasks/view', id];
	}

	private showTask(task: ITask): void {
		this.viewStatus = taskStatusOf(task);
		this.viewSections = buildTaskViewSections(task, {
			translate: (key) => this.getTranslation(key),
			hash: (value) => this._hashPipe.transform(value)
		});
		this.viewedTask = task;
	}

	/* ── Projects ────────────────────────────────────────────────────────── */

	/**
	 * Opens a project in the quick-look drawer without leaving the team page. It
	 * opens at once with the card's name and logo, then fills in from the
	 * project's full read (members, dates, billing, description…); a failed read
	 * (e.g. no permission to view projects) keeps what the card had.
	 */
	async openProject(row: IProjectOverviewRow): Promise<void> {
		this.closeTask();
		const sequence = ++this._projectSequence;
		this.viewedProjectCard = row;
		this.showProject({ id: row.id, name: row.name, imageUrl: row.imageUrl } as IOrganizationProject);
		this.projectAttention = [];
		this.projectBudget = null;
		this.projectTasks = [];
		this.projectTaskFilter = 'open';
		this.showAllProjectTasks = false;
		void this.loadProjectProgress(row.id, sequence);
		this.loadProjectPeriodFigures(row.id, sequence);
		try {
			const project = await firstValueFrom(this._projectsService.getById(row.id, PROJECT_VIEW_RELATIONS));
			if (sequence === this._projectSequence && this.viewedProject?.id === row.id && project) {
				this.showProject(project);
				void this.loadProjectBudget(project, sequence);
			}
		} catch {
			// The card's own data stays on screen.
		}
	}

	/** How many of the project's tasks a filter keeps. */
	projectTaskCount(filter: TaskFilter): number {
		return this.filterTaskRows(this.projectTasks, filter).length;
	}

	get filteredProjectTasks(): ITeamTaskRow[] {
		return this.filterTaskRows(this.projectTasks, this.projectTaskFilter);
	}

	get visibleProjectTasks(): ITeamTaskRow[] {
		const rows = this.filteredProjectTasks;
		return this.showAllProjectTasks ? rows : rows.slice(0, PROJECT_TASK_LIMIT);
	}

	setProjectTaskFilter(filter: TaskFilter): void {
		this.projectTaskFilter = filter;
		this.showAllProjectTasks = false;
	}

	/** The team's hours on the open project over the period, tracked and manual. */
	get projectHoursTotal(): number {
		return (this.projectHours.value || []).reduce((sum, day) => sum + day.tracked + day.manual, 0);
	}

	closeProject(): void {
		this._projectSequence++;
		this.viewedProject = null;
		this.viewedProjectCard = null;
		this.projectFacts = null;
	}

	/** The project's edit page, where its details are managed. */
	projectEditLink(id: string): string[] {
		return ['/pages/organization/projects', id, 'edit'];
	}

	/**
	 * The project's task completion. A task counts as done when its status is
	 * terminal (a tenant status's own `isDone` flag included), the same rule the
	 * task views use.
	 */
	private async loadProjectProgress(projectId: string, sequence: number): Promise<void> {
		const { organizationId, tenantId } = this.team;
		this.projectProgress = Loadable.empty(null);
		try {
			const result = await firstValueFrom(
				this._http.get<IPagination<ITask>>(`${API_PREFIX}/tasks`, {
					params: toParams({
						where: { organizationId, tenantId, projectId },
						relations: ['taskStatus', 'taskPriority', 'members', 'members.user']
					})
				})
			);
			if (sequence !== this._projectSequence) return;
			const tasks = result?.items || [];
			this.projectAttention = this.toAttentionTasks(tasks);
			this.projectTasks = this.toTaskRows(tasks);
			const done = tasks.filter((task) => isTaskFinished(task)).length;
			const progress = tasks.filter(
				(task) => !isTaskFinished(task) && ViewTeamComponent.statusGroupOf(task.status) === 'progress'
			).length;
			this.projectProgress = {
				loading: false,
				failed: false,
				value: {
					total: tasks.length,
					done,
					progress,
					todo: tasks.length - done - progress,
					percent: tasks.length ? (done / tasks.length) * 100 : 0
				}
			};
		} catch {
			if (sequence === this._projectSequence)
				this.projectProgress = { loading: false, failed: true, value: null };
		}
	}

	/** Overdue first, then soonest due: open tasks past due or due within a few days. */
	private toAttentionTasks(tasks: ITask[]): IAttentionTask[] {
		const today = moment().startOf('day');
		return tasks
			.filter((task) => !!task.dueDate && !isTaskFinished(task))
			.map((task) => ({ task, daysLeft: moment(task.dueDate).startOf('day').diff(today, 'days') }))
			.filter(({ daysLeft }) => daysLeft <= ATTENTION_DAYS)
			.sort((a, b) => a.daysLeft - b.daysLeft)
			.slice(0, LIST_LIMIT)
			.map(({ task, daysLeft }) => ({
				id: task.id,
				title: task.title,
				due: ViewTeamComponent.dueInWords(daysLeft, false),
				overdue: daysLeft < 0
			}));
	}

	/** What the project's figures read over the period: contributors, hours per day, top tasks. */
	private loadProjectPeriodFigures(projectId: string, sequence: number): void {
		void this.loadProjectContributors(projectId, sequence);
		void this.loadProjectHours(projectId, sequence);
		void this.loadProjectTopTasks(projectId, sequence);
	}

	/** The team's hours on the project per day of the period, tracked and manual. */
	private async loadProjectHours(projectId: string, sequence: number): Promise<void> {
		this.projectHours = { ...this.projectHours, loading: true, failed: false };
		if (!this.members.length) {
			this.projectHours = { loading: false, failed: false, value: [] };
			return;
		}
		try {
			const rows = await this._timesheetService.getDailyReportChart({
				...this.buildRequest(this.periodRange()),
				projectIds: [projectId]
			});
			if (sequence !== this._projectSequence) return;
			this.projectHours = { loading: false, failed: false, value: this.toHoursDays(rows) };
		} catch {
			if (sequence === this._projectSequence) this.projectHours = { loading: false, failed: true, value: [] };
		}
	}

	/** The project's tasks the team worked on the most in the period. */
	private async loadProjectTopTasks(projectId: string, sequence: number): Promise<void> {
		this.projectTopTasks = { ...this.projectTopTasks, loading: true, failed: false };
		if (!this.members.length) {
			this.projectTopTasks = { loading: false, failed: false, value: [] };
			return;
		}
		try {
			const rows = await this._statisticsService.getTasksStatistics({
				...this.buildRequest(this.periodRange()),
				projectIds: [projectId]
			});
			if (sequence !== this._projectSequence) return;
			this.projectTopTasks = {
				loading: false,
				failed: false,
				value: this.rank(rows, (task: ITasksStatistics) => ({ id: task.id, name: task.title }), 5)
			};
		} catch {
			if (sequence === this._projectSequence) this.projectTopTasks = { loading: false, failed: true, value: [] };
		}
	}

	/**
	 * An hours budget against all the time worked on the project since it started,
	 * by anyone. A cost budget needs rates, so it is left to the Details row.
	 */
	private async loadProjectBudget(project: IOrganizationProject, sequence: number): Promise<void> {
		const budgetHours = Number(project.budget) || 0;
		if (project.budgetType !== OrganizationProjectBudgetTypeEnum.HOURS || budgetHours <= 0) return;
		const { organizationId, tenantId } = this.team;
		const timeZone = this._timeZoneService.currentTimeZone;
		const format = (date: moment.Moment) => toUtcOffset(date, timeZone).format('YYYY-MM-DD HH:mm:ss');
		try {
			const rows = await this._statisticsService.getProjects({
				tenantId,
				organizationId,
				projectIds: [project.id],
				startDate: format(moment(project.startDate || project.createdAt).startOf('day')),
				endDate: format(moment().endOf('day'))
			});
			if (sequence !== this._projectSequence) return;
			const seconds = (rows || []).find((row) => row.id === project.id)?.duration || 0;
			const usedHours = Number(seconds) / 3600;
			const used = (usedHours / budgetHours) * 100;
			this.projectBudget = {
				usedHours,
				budgetHours,
				percent: Math.min(100, used),
				over: used > 100,
				warning: used >= 80
			};
		} catch {
			// No budget bar; the Details panel still lists the budget.
		}
	}

	/**
	 * The team members who worked on the project the most in the period — the
	 * same people and window as the card's time, so the shares add up to it.
	 */
	private async loadProjectContributors(projectId: string, sequence: number): Promise<void> {
		this.projectContributors = { ...this.projectContributors, loading: true, failed: false };
		// No members: an empty employee filter would read the whole organization.
		if (!this.members.length) {
			this.projectContributors = { loading: false, failed: false, value: [] };
			return;
		}
		try {
			const rows = await this._statisticsService.getMembers({
				...this.buildRequest(this.periodRange()),
				projectIds: [projectId]
			});
			if (sequence !== this._projectSequence) return;
			const people = new Map(this.members.map((member) => [member.id, member]));
			const ranked = this.rank(
				(rows || []).map((row: IMembersStatistics) => ({
					id: row.id,
					name: people.get(row.id)?.name || row.user?.name,
					duration: Number(row.weekTime?.duration) || 0
				})),
				(row) => row
			);
			const stats = new Map((rows || []).map((row) => [row.id, row]));
			this.projectContributors = {
				loading: false,
				failed: false,
				value: ranked.map((row) => {
					const member = people.get(row.id);
					const weekTime = stats.get(row.id)?.weekTime;
					return {
						...row,
						initials: member?.initials || ViewTeamComponent.initialsOf(row.name),
						avatarUrl: member?.avatarUrl || stats.get(row.id)?.user?.imageUrl || undefined,
						activity: weekTime ? Number(weekTime.overall) || 0 : undefined,
						presence: member?.presence
					};
				})
			};
		} catch {
			if (sequence === this._projectSequence)
				this.projectContributors = { loading: false, failed: true, value: [] };
		}
	}

	private showProject(project: IOrganizationProject): void {
		this.projectSections = buildProjectViewSections(project, {
			translate: (key) => this.getTranslation(key)
		});
		this.projectFacts = this.toProjectFacts(project);
		this.viewedProject = project;
	}

	/** Status line and key figures; a finished project's end date is no longer a deadline. */
	private toProjectFacts(project: IOrganizationProject): IProjectFacts {
		const isFinished = [ProjectStatusEnum.COMPLETED, ProjectStatusEnum.CANCELLED].includes(project.status);
		const daysLeft = project.endDate
			? moment(project.endDate).startOf('day').diff(moment().startOf('day'), 'days')
			: null;
		return {
			status: projectStatusOf(project),
			isPublic: project.public,
			client: project.organizationContact?.name,
			members: project.members ? project.members.filter((member) => !!member?.employee).length : null,
			endDate: project.endDate ? moment(project.endDate).format('ll') : undefined,
			due: daysLeft === null || isFinished ? null : ViewTeamComponent.dueInWords(daysLeft, false),
			overdue: !isFinished && daysLeft !== null && daysLeft < 0
		};
	}

	get taskSummary(): TaskSummary {
		const rows = this.tasks.value || [];
		if (this._taskSummary?.from !== rows) {
			const value: TaskSummary = { open: 0, todo: 0, progress: 0, blocked: 0, overdue: 0, done: 0 };
			for (const row of rows) {
				if (row.statusGroup === 'done') {
					value.done++;
					continue;
				}
				value.open++;
				value[row.statusGroup]++;
				if (row.overdue) value.overdue++;
			}
			this._taskSummary = { from: rows, value };
		}
		return this._taskSummary.value;
	}

	taskCount(filter: TaskFilter): number {
		return this.taskSummary[filter];
	}

	get filteredTasks(): ITeamTaskRow[] {
		return this.filterTaskRows(this.tasks.value || [], this.taskFilter);
	}

	/** Open hides done tasks; Done lists the most recently finished first. */
	private filterTaskRows(rows: ITeamTaskRow[], filter: TaskFilter): ITeamTaskRow[] {
		switch (filter) {
			case 'progress':
				return rows.filter((row) => row.statusGroup === 'progress');
			case 'overdue':
				return rows.filter((row) => row.overdue);
			case 'done':
				return rows.filter((row) => row.statusGroup === 'done').sort((a, b) => b.doneTime - a.doneTime);
			case 'open':
			default:
				return rows.filter((row) => row.statusGroup !== 'done');
		}
	}

	get visibleTasks(): ITeamTaskRow[] {
		return this.showAllTasks ? this.filteredTasks : this.filteredTasks.slice(0, TASK_LIMIT);
	}

	/* ── Loading ─────────────────────────────────────────────────────────── */

	private loadFigures(): void {
		const team = this.team;
		if (!team?.organizationId) return;

		// An open project quick look follows the period too.
		if (this.viewedProject) {
			this.loadProjectPeriodFigures(this.viewedProject.id, this._projectSequence);
		}

		// A team with nobody on it has no figures: an empty employee filter would
		// read the whole organization instead.
		if (!this.members.length) {
			// Also cancels any request still in flight for these panels.
			for (const key of [
				'counts',
				'previousCounts',
				'hours',
				'memberStats',
				'projectStats',
				'topTasks',
				'apps'
			] as PanelKey[]) {
				delete this._pending[key];
			}
			const done = <T>(value: T): Loadable<T> => ({ loading: false, failed: false, value });
			this.counts = done(null);
			this.previousCounts = done(null);
			this.hours = done([]);
			this.memberStats = done({});
			this.projectStats = done([]);
			this.topTasks = done([]);
			this.apps = done([]);
		} else {
			const request = this.buildRequest(this.periodRange());
			const previous = this.buildRequest(this.previousRange());

			void this.track('counts', () => this._statisticsService.getCounts(request));
			void this.track('previousCounts', () => this._statisticsService.getCounts(previous));
			void this.track('hours', async () =>
				this.toHoursDays(await this._timesheetService.getDailyReportChart(request))
			);
			void this.track('memberStats', async () =>
				this.toMemberFigures(await this._statisticsService.getMembers(request))
			);
			// Kept whole (no top-N cut): the Projects panel lists every project of the team.
			void this.track('projectStats', async () =>
				this.rank(
					await this._statisticsService.getProjects(request),
					(project: IProjectsStatistics) => ({
						id: project.id,
						name: project.name
					}),
					Infinity
				)
			);
			void this.track('topTasks', async () =>
				this.rank(await this._statisticsService.getTasksStatistics(request), (task: ITasksStatistics) => ({
					id: task.id,
					name: task.title,
					meta: task.project?.name
				}))
			);
			void this.track('apps', async () =>
				this.rank(await this._statisticsService.getActivities(request), (activity: IActivitiesStatistics) => ({
					id: activity.title,
					name: activity.title
				}))
			);
		}

		// The team's tasks do not depend on the period, but reload with it so the page reads as current.
		void this.track('tasks', async () => this.toTaskRows(await this.fetchTeamTasks(team)));
	}

	/** Every task assigned to this team. */
	private async fetchTeamTasks(team: IOrganizationTeam): Promise<ITask[]> {
		const { organizationId, tenantId } = team;
		const result = await firstValueFrom(
			this._http.get<IPagination<ITask>>(`${API_PREFIX}/tasks/team`, {
				params: toParams({
					where: { organizationId, tenantId, teams: [team.id] },
					relations: ['project', 'members', 'members.user']
				})
			})
		);
		return result?.items || [];
	}

	/** Runs one panel's request; a response that is no longer the latest is dropped. */
	private async track(key: PanelKey, fetch: () => Promise<any>): Promise<void> {
		const token = {};
		this._pending[key] = token;
		const panel = this as unknown as Record<PanelKey, Loadable<any>>;
		panel[key] = { ...panel[key], loading: true, failed: false };
		try {
			const value = await fetch();
			if (this._pending[key] === token) panel[key] = { loading: false, failed: false, value };
		} catch {
			if (this._pending[key] === token) panel[key] = { ...panel[key], loading: false, failed: true };
		}
	}

	/** A window as the statistics endpoints expect it, scoped to the team's members. */
	private buildRequest(range: { start: moment.Moment; end: moment.Moment }): ITimeLogFilters & ITimeLogTodayFilters {
		const { organizationId, tenantId } = this.team;
		const timeZone = this._timeZoneService.currentTimeZone;
		const format = (date: moment.Moment) => toUtcOffset(date, timeZone).format('YYYY-MM-DD HH:mm:ss');
		return {
			tenantId,
			organizationId,
			employeeIds: this.members.map((member) => member.id),
			startDate: format(range.start),
			endDate: format(range.end),
			todayStart: format(moment().startOf('day')),
			todayEnd: format(moment().endOf('day')),
			timeZone
		};
	}

	private toHoursDays(rows: any): IEmployeeHoursDay[] {
		const format = this.period === TeamViewPeriod.THIS_WEEK ? 'ddd D' : 'D MMM';
		return (Array.isArray(rows) ? rows : []).map((row: any) => ({
			label: moment(row.date).format(format),
			tracked: (Number(row.value?.[TimeLogType.TRACKED]) || 0) + (Number(row.value?.[TimeLogType.RESUMED]) || 0),
			manual: Number(row.value?.[TimeLogType.MANUAL]) || 0
		}));
	}

	private toMemberFigures(rows: IMembersStatistics[]): Record<string, IMemberFigures> {
		const figures: Record<string, IMemberFigures> = {};
		for (const row of rows || []) {
			if (!row?.id) continue;
			figures[row.id] = {
				duration: Number(row.weekTime?.duration) || 0,
				activity: Number(row.weekTime?.overall) || 0,
				today: Number(row.todayTime?.duration) || 0
			};
		}
		return figures;
	}

	private rank<T extends { duration?: number }>(
		items: T[],
		describe: (item: T) => Pick<IRankedRow, 'id' | 'name' | 'meta'>,
		limit = LIST_LIMIT
	): IRankedRow[] {
		const all = (items || [])
			.map((item) => ({ ...describe(item), duration: Number(item.duration) || 0 }))
			.filter((row) => row.duration > 0 && row.name)
			.sort((a, b) => b.duration - a.duration);
		const total = all.reduce((sum, row) => sum + row.duration, 0) || 1;
		const max = all[0]?.duration || 1;
		return all.slice(0, limit).map((row) => ({
			...row,
			share: (row.duration / total) * 100,
			width: Math.max(2, (row.duration / max) * 100)
		}));
	}

	/** Overdue first, then soonest due; undated last. */
	private toTaskRows(tasks: ITask[]): ITeamTaskRow[] {
		const today = moment().startOf('day');
		return tasks
			.map((task) => this.toTaskRow(task, today))
			.sort(
				(a, b) => Number(b.overdue) - Number(a.overdue) || (a.dueTime === b.dueTime ? 0 : a.dueTime - b.dueTime)
			);
	}

	private toTaskRow(task: ITask, today: moment.Moment): ITeamTaskRow {
		const statusGroup = ViewTeamComponent.statusGroupOf(task.status);
		const isDone = statusGroup === 'done';
		const daysLeft = task.dueDate ? moment(task.dueDate).startOf('day').diff(today, 'days') : null;
		const people = (task.members || [])
			.map((member) => {
				const name = ViewTeamComponent.nameOf(member);
				return {
					id: member.id,
					name,
					initials: ViewTeamComponent.initialsOf(name),
					avatarUrl: member.user?.image?.fullUrl || member.user?.imageUrl || undefined,
					email: member.user?.email,
					presence: ViewTeamComponent.presenceOf(member as IEmployee),
					bio: member.short_description?.trim() || undefined,
					since: member.startedWorkOn ? moment(member.startedWorkOn).format('ll') : undefined
				} as ITaskPerson;
			})
			.filter((person) => !!person.name);
		const priority = (task.taskPriority?.name || task.priority || '').toLowerCase();
		return {
			task,
			people,
			morePeople: people.slice(3),
			dueDateLong: task.dueDate ? moment(task.dueDate).format('dddd, LL') : undefined,
			priority: task.taskPriority?.name || ViewTeamComponent.humanize(task.priority) || undefined,
			priorityLevel: PRIORITY_LEVELS.has(priority) ? (priority as ITeamTaskRow['priorityLevel']) : undefined,
			id: task.id,
			key: task.prefix && task.number ? `${task.prefix}-${task.number}` : '',
			title: task.title,
			project: task.project?.name,
			status: task.taskStatus?.name || ViewTeamComponent.humanize(task.status) || '',
			statusGroup,
			dueDate: task.dueDate ? moment(task.dueDate).format('ll') : undefined,
			due: ViewTeamComponent.dueInWords(daysLeft, isDone),
			dueTime: task.dueDate ? moment(task.dueDate).valueOf() : Infinity,
			doneTime: moment(task.resolvedAt || task.updatedAt || 0).valueOf(),
			overdue: !isDone && daysLeft !== null && daysLeft < 0
		};
	}

	/* ── Details ─────────────────────────────────────────────────────────── */

	/** The Details tab as a view model; empty values are dropped so only what is set is laid out. */
	private buildDetails(team: IOrganizationTeam): {
		general: IDetailField[];
		settings: IDetailField[];
		record: IDetailField[];
	} {
		const t = (key: string) => this.getTranslation(key);
		const onOff = (value: boolean) => t(value ? 'EMPLOYEES_PAGE.ENABLED' : 'EMPLOYEES_PAGE.DISABLED');
		const date = (value?: Date | string) => (value ? moment(value).format('lll') : undefined);
		const keep = (fields: IDetailField[]) => fields.filter((field) => !!field.value);
		const profileLink = team.profile_link?.trim();

		return {
			general: keep([
				{ label: 'ORGANIZATIONS_PAGE.NAME', value: team.name },
				{ label: 'ORGANIZATIONS_PAGE.EDIT.TEAMS_PAGE.VIEW.PREFIX', value: team.prefix },
				{ label: 'ORGANIZATIONS_PAGE.EDIT.TEAMS_PAGE.VIEW.TEAM_SIZE', value: team.teamSize },
				{ label: 'ORGANIZATIONS_PAGE.EDIT.TEAMS_PAGE.VIEW.COLOR', value: team.color, swatch: team.color },
				{ label: 'ORGANIZATIONS_PAGE.EDIT.TEAMS_PAGE.VIEW.EMOJI', value: team.emoji },
				{
					label: 'ORGANIZATIONS_PAGE.EDIT.TEAMS_PAGE.VIEW.PROFILE_LINK',
					value: profileLink,
					href: profileLink && (/^https?:\/\//i.test(profileLink) ? profileLink : undefined)
				}
			]),
			settings: [
				{
					label: 'ORGANIZATIONS_PAGE.EDIT.TEAMS_PAGE.VIEW.VISIBILITY',
					value: t(
						team.public
							? 'ORGANIZATIONS_PAGE.EDIT.TEAMS_PAGE.VIEW.PUBLIC'
							: 'ORGANIZATIONS_PAGE.EDIT.TEAMS_PAGE.VIEW.PRIVATE'
					)
				},
				{
					label: 'ORGANIZATIONS_PAGE.EDIT.TEAMS_PAGE.VIEW.SHARE_PROFILE_VIEW',
					value: onOff(team.shareProfileView !== false)
				},
				{
					label: 'ORGANIZATIONS_PAGE.EDIT.TEAMS_PAGE.VIEW.REQUIRE_PLAN',
					value: onOff(!!team.requirePlanToTrack)
				},
				{
					label: 'SM_TABLE.TIME_TRACKING',
					value: this.getTranslation('ORGANIZATIONS_PAGE.EDIT.TEAMS_PAGE.VIEW.OF_MEMBERS', {
						count: this.trackingEnabledCount,
						total: this.members.length
					})
				}
			],
			record: keep([
				{ label: 'ORGANIZATIONS_PAGE.EDIT.TEAMS_PAGE.VIEW.CREATED', value: date(team.createdAt) },
				{ label: 'ORGANIZATIONS_PAGE.EDIT.TEAMS_PAGE.VIEW.UPDATED', value: date(team.updatedAt) }
			])
		};
	}

	/* ── Helpers ─────────────────────────────────────────────────────────── */

	private static nameOf(person: IEmployee | any): string {
		const user = person?.user || person;
		const parts = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
		return person?.fullName || user?.name || parts || user?.email || '';
	}

	private static initialsOf(name: string): string {
		return (name || '')
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0].toUpperCase())
			.join('');
	}

	private static presenceOf(employee: IEmployee): Presence {
		if (employee?.isTrackingTime) return 'tracking';
		if (employee?.isOnline && employee?.isAway) return 'away';
		if (employee?.isOnline) return 'online';
		return 'offline';
	}

	private static statusGroupOf(status: string | undefined): ITeamTaskRow['statusGroup'] {
		const value = (status || '').toLowerCase();
		if (CLOSED_STATUSES.has(value)) return 'done';
		if (IN_PROGRESS_STATUSES.has(value)) return 'progress';
		if (value === TaskStatusEnum.BLOCKED) return 'blocked';
		return 'todo';
	}

	private static dueInWords(daysLeft: number | null, isDone: boolean): ITeamTaskRow['due'] {
		const prefix = 'EMPLOYEES_PAGE.VIEW.DUE.';
		if (daysLeft === null) return { key: prefix + 'NONE' };
		if (isDone) return { key: prefix + 'WAS_DUE' };
		if (daysLeft < -1) return { key: prefix + 'OVERDUE_DAYS', count: -daysLeft };
		if (daysLeft === -1) return { key: prefix + 'OVERDUE_DAY' };
		if (daysLeft === 0) return { key: prefix + 'TODAY' };
		if (daysLeft === 1) return { key: prefix + 'TOMORROW' };
		return { key: prefix + 'IN_DAYS', count: daysLeft };
	}

	private static humanize(value?: string): string {
		if (!value) return '';
		const text = value.replace(/[-_]+/g, ' ').trim();
		return text.charAt(0).toUpperCase() + text.slice(1);
	}
}
