import { ChangeDetectorRef, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import * as moment from 'moment';
import { combineLatest, debounceTime, tap } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import {
	IGetCountsStatistics,
	IGetTimeLogReportInput,
	IOrganizationTeam,
	ISelectedEmployee,
	ITimeLog,
	ReportGroupFilterEnum,
	RolesEnum
} from '@gauzy/contracts';
import {
	DateRangePickerBuilderService,
	ErrorHandlingService,
	OrganizationProjectsService,
	OrganizationTeamsService,
	Store,
	TimesheetService,
	TimesheetStatisticsService
} from '@gauzy/ui-core/core';
import { BaseSelectorFilterComponent, TimeZoneService } from '@gauzy/ui-core/shared';
import {
	IMemberRow,
	IProjectWorked,
	IRankedMember,
	ITeamPerson,
	ITeamPersonDay,
	ITeamRow,
	activityOf,
	activityTone,
	avatarOf,
	fitProjectsPopover,
	formatDuration,
	formatPercent,
	initialsOf,
	presenceOf,
	toPercentage
} from './team-dashboard.utils';

/** Lines of the "Top members today" ranking. */
const TOP_MEMBERS_LIMIT = 6;

/** Order of the members table: who is tracking first, then the longest day, then by name. */
const PRESENCE_RANK = { tracking: 0, online: 1, away: 2, offline: 3 };

/**
 * The Teams dashboard: today's time across the organization's teams.
 *
 * Built on the team page's sheet (`view-employee` + `view-team` patterns) so a
 * team reads the same here and on its own page: underline tabs switch between
 * "All teams" and one team, each with a divided summary strip and hairline
 * panels holding real tables.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gauzy-teams',
	templateUrl: './team.component.html',
	styleUrls: [
		'../../employees/view-employee/view-employee.component.scss',
		'./team-dashboard.shared.scss',
		'./team.component.scss'
	],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class TeamComponent extends BaseSelectorFilterComponent implements OnInit, OnDestroy {
	public readonly formatDuration = formatDuration;
	public readonly formatPercent = formatPercent;
	public readonly activityTone = activityTone;
	/** Fits the "Projects worked" popover to the screen as it opens. */
	protected readonly fitProjectsPopover = fitProjectsPopover;

	private _logs: ITimeLog[] = [];
	private _countsStatistics: any;
	private _dailyLogs: any[] = [];
	private _selectedEmployee: ISelectedEmployee;
	private _selectedOrganizationTeam: IOrganizationTeam;
	private _teams: IOrganizationTeam[] = [];
	private _todayTeamsWorkers: any[] = [];

	public isLoading = false;

	/** Whether the team tabs overflow towards their start / end — shows that side's arrow and fade. */
	public canScrollStart = false;
	public canScrollEnd = false;

	private _tabsList: HTMLElement | null = null;
	private _tabsResizeObserver: ResizeObserver | null = null;

	/** The tabs strip only exists once teams are loaded, so it is watched as it comes and goes. */
	@ViewChild('tabsList')
	set tabsList(ref: ElementRef<HTMLElement> | undefined) {
		const element = ref?.nativeElement ?? null;
		if (element === this._tabsList) {
			return;
		}
		this._tabsResizeObserver?.disconnect();
		this._tabsList = element;
		if (element && typeof ResizeObserver !== 'undefined') {
			// Outside Angular: a resize only toggles two flags, set back inside the zone when they change.
			this._ngZone.runOutsideAngular(() => {
				this._tabsResizeObserver = new ResizeObserver(() => this._ngZone.run(() => this.updateTabsScroll()));
				this._tabsResizeObserver.observe(element);
			});
		}
		// Deferred: the query is refreshed after the template was checked, so flipping the bound
		// arrow flags synchronously here would raise ExpressionChangedAfterItHasBeenChecked.
		setTimeout(() => this.updateTabsScroll());
	}

	/** `null` shows "All teams"; otherwise the id of the open team. */
	public selectedTeamId: string | null = null;

	public teamRows: ITeamRow[] = [];
	public memberRows: IMemberRow[] = [];
	/** Every team's member rows, for the open team and the overview's expandable rows. */
	public membersByTeam: Record<string, IMemberRow[]> = {};
	public topMembers: IRankedMember[] = [];
	/** Every project worked on across the listed teams, for the overview's "Projects worked" list. */
	public overviewProjects: IProjectWorked[] = [];
	public projectCount = 0;
	/** Sequence of the project-count requests: only the latest one may write `projectCount`. */
	private _projectCountRequest = 0;

	/** Organization-wide figures of the "All teams" summary strip. */
	public overview = {
		teamsWorked: 0,
		membersWorked: 0,
		membersTotal: 0,
		projectsWorked: 0,
		duration: 0,
		activity: 0
	};

	constructor(
		protected readonly translateService: TranslateService,
		protected readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		protected readonly store: Store,
		protected readonly timeZoneService: TimeZoneService,
		private readonly _organizationTeamsService: OrganizationTeamsService,
		private readonly _organizationProjectsService: OrganizationProjectsService,
		private readonly _timesheetStatisticsService: TimesheetStatisticsService,
		private readonly _timesheetService: TimesheetService,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly _ngZone: NgZone,
		private readonly _cdr: ChangeDetectorRef
	) {
		super(store, translateService, dateRangePickerBuilderService, timeZoneService);
		this._selectedOrganizationTeam = null;
	}

	/** The open team's row, or `null` on "All teams". */
	public get selectedTeam(): ITeamRow | null {
		return this.teamRows.find((row) => row.id === this.selectedTeamId) ?? null;
	}

	private get _period() {
		const endWork = moment(this.organization.defaultEndTime, 'HH:mm');
		const startWork = moment(this.organization.defaultStartTime, 'HH:mm');
		const duration = endWork.diff(startWork) / 1000;
		return isNaN(duration) ? 86400 : duration;
	}

	ngOnDestroy(): void {
		this._tabsResizeObserver?.disconnect();
	}

	ngOnInit(): void {
		this.subject$
			.pipe(
				debounceTime(100),
				tap(() => this._clearItem()),
				tap(() => this._loadTeams()),
				tap(() => this._loadProjectsCount()),
				untilDestroyed(this)
			)
			.subscribe();
		combineLatest([this.store.selectedEmployee$, this.store.selectedTeam$])
			.pipe(
				tap(([employee, organizationTeam]) => {
					this._selectedEmployee = employee;
					this._selectedOrganizationTeam = organizationTeam;
				}),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/** Opens one team, or "All teams" for `null`. */
	public select(teamId: string | null): void {
		this.selectedTeamId = teamId;
		this._buildMemberRows();
		this._revealActiveTab();
	}

	/**
	 * Re-reads which sides of the team tabs have more to scroll to. Sides are LOGICAL: in a
	 * right-to-left layout `scrollLeft` runs from 0 towards negative values, so the distance from
	 * the start edge is its absolute value.
	 */
	public updateTabsScroll(): void {
		const list = this._tabsList;
		const position = list ? Math.abs(list.scrollLeft) : 0;
		const maxPosition = list ? list.scrollWidth - list.clientWidth : 0;
		// One pixel of slack: fractional widths leave `scrollLeft` a hair short of the end.
		const start = !!list && position > 1;
		const end = !!list && position < maxPosition - 1;
		if (start !== this.canScrollStart || end !== this.canScrollEnd) {
			this.canScrollStart = start;
			this.canScrollEnd = end;
			this._cdr.markForCheck();
		}
	}

	/**
	 * Scrolls the team tabs by most of a visible width towards their logical start (`-1`) or end
	 * (`1`); in a right-to-left layout moving towards the end means a negative `left`.
	 */
	public scrollTabs(direction: 1 | -1): void {
		const list = this._tabsList;
		if (!list) {
			return;
		}
		const rtl = getComputedStyle(list).direction === 'rtl';
		const distance = direction * list.clientWidth * 0.8;
		list.scrollBy({ left: rtl ? -distance : distance, behavior: 'smooth' });
	}

	/**
	 * Keyboard interaction of the team tablist: Left / Right move to the neighbouring tab
	 * (swapped in a right-to-left layout, wrapping at the ends), Home / End to the first / last.
	 * The focused tab is opened at once (automatic activation), so focus and the panel agree.
	 */
	public onTabsKeydown(event: KeyboardEvent): void {
		const list = this._tabsList;
		if (!list) {
			return;
		}
		const tabs = Array.from(list.querySelectorAll<HTMLElement>('[role="tab"]'));
		const index = tabs.indexOf(event.target as HTMLElement);
		if (index < 0) {
			return;
		}
		const step = getComputedStyle(list).direction === 'rtl' ? -1 : 1;
		let next: number;
		switch (event.key) {
			case 'ArrowRight':
				next = index + step;
				break;
			case 'ArrowLeft':
				next = index - step;
				break;
			case 'Home':
				next = 0;
				break;
			case 'End':
				next = tabs.length - 1;
				break;
			default:
				return;
		}
		event.preventDefault();
		const target = tabs[(next + tabs.length) % tabs.length];
		target.focus();
		target.click();
	}

	/** Brings the selected tab fully into view, clear of the arrows. */
	private _revealActiveTab(): void {
		setTimeout(() => {
			const tab = this._tabsList?.querySelector<HTMLElement>('.tab.is-active');
			tab?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
		});
	}

	public reset(): void {
		this.select(null);
	}

	private _loadTeams(): void {
		if (!this.organization) {
			return;
		}
		const { id: organizationId, tenantId } = this.organization;

		this.isLoading = true;
		this._organizationTeamsService
			// `projects`: the teams' own projects, listed under their "Projects worked" tiles.
			.getAll(['members', 'members.role', 'members.employee', 'members.employee.user', 'projects'], {
				organizationId,
				tenantId
			})
			.then(async (res) => {
				this._teams = res.items;
				await this.getTimeLogs();
			})
			.catch((e) => {
				console.error(e);
				this.isLoading = false;
			});
	}

	private async _loadProjectsCount(): Promise<void> {
		if (!this.organization) {
			return;
		}
		const { id: organizationId, tenantId } = this.organization;
		// Filters can change while a count is in flight: an older answer, success or failure, is dropped.
		const request = ++this._projectCountRequest;
		try {
			const count = await this._organizationProjectsService.getCount({ organizationId, tenantId });
			if (request === this._projectCountRequest) {
				this.projectCount = count;
			}
		} catch (e) {
			if (request === this._projectCountRequest) {
				this.projectCount = 0;
			}
		}
	}

	private async getTimeLogs() {
		if (!this.organization) {
			return;
		}
		const request: IGetTimeLogReportInput = {
			...this.getFilterRequest(this.request),
			groupBy: ReportGroupFilterEnum.employee
		};
		try {
			// `timeSlots` carry the active / tracked seconds that team-scoped activity is computed from.
			this._logs = await this._timesheetService.getTimeLogs(request, ['project', 'task', 'employee.user', 'timeSlots']);
			this._dailyLogs = await this._timesheetService.getDailyReport(request);
			await this.teamMapper();
		} catch (error) {
			console.log('Error while loading logs', error);
			this._errorHandlingService.handleError(error);
			this.isLoading = false;
		}
	}

	private async teamMapper() {
		let projects = [];
		let allMembers = [];
		let allMembersWorking = [];
		this._todayTeamsWorkers = this._teams
			.map((team) => {
				const isTeamMember = team.members.some((member) => member.employeeId === this._selectedEmployee?.id);
				if (
					(!isTeamMember && this._selectedEmployee?.id) ||
					(this._selectedOrganizationTeam?.id && team.id !== this._selectedOrganizationTeam.id)
				) {
					return null;
				}
				const members = team.members.map((member) => {
					const [memberDailyLog] = this._dailyLogs.filter(
						(dailyLog) => dailyLog.employee.userId === member.employee.userId
					);
					const logs = this._logs.filter(
						(log) =>
							!!log &&
							log.employee.userId === member.employee.userId &&
							log.organizationTeamId === team.id
					);
					const isWorkingToday = logs.length > 0;
					const groupByTask = isWorkingToday ? this._groupBy('taskId', logs) : [];
					const groupByProject = isWorkingToday ? this._groupBy('projectId', logs) : [];
					const projectKeys = Object.keys(groupByProject);
					const taskKeys = Object.keys(groupByTask);
					const tasks = taskKeys
						.map((value: string) => {
							return {
								...groupByTask[value][0].task,
								project: groupByTask[value][0].project,
								duration: groupByTask[value].reduce((accumulator, log) => {
									return accumulator + log.duration;
								}, 0)
							};
						})
						.sort((a, b) => b.duration - a.duration);
					const todayWorkDuration = tasks.reduce((accumulator: number, task) => {
						return accumulator + (task?.duration || 0);
					}, 0);
					const proj = projectKeys.map((value: string) => {
						return {
							...groupByProject[value][0].project
						};
					});
					projects.push(...proj);
					// Time per project, for the "Projects worked" list; logs without a project are not one.
					const projectTimes = projectKeys
						.map((value: string) => ({
							project: groupByProject[value][0].project,
							duration: groupByProject[value].reduce((total, log) => total + (log.duration || 0), 0)
						}))
						.filter(({ project }) => !!project?.id);
					// This team's slots only, like the duration beside it; the daily report is grouped by
					// employee alone, so its figure spans every team the person worked on.
					const slots = logs.flatMap((log) => log.timeSlots ?? []);
					const latestLog = this._latestLog(logs);
					return {
						...member,
						// What the person is on now — or was on last — for their hover card.
						latestTask: latestLog
							? { title: latestLog.task?.title || null, projectName: latestLog.project?.name || null }
							: null,
						latestTaskAt: latestLog ? this._logTime(latestLog) : 0,
						latestTaskRunning: !!latestLog?.isRunning,
						// From the same log as the task above, so "Working on" and the task agree
						// whatever order the logs arrive in.
						isRunningTimer: !!latestLog?.isRunning,
						todayWorkDuration,
						isWorkingToday: isWorkingToday,
						tasks: tasks,
						projects: proj,
						projectTimes,
						workPeriod: this._period,
						slots,
						activity: activityOf(slots),
						dayActivity: memberDailyLog ? memberDailyLog.activity : null
					};
				});
				const membersOnline = members.filter((member) => member.isRunningTimer);
				const membersWorkingToday = members.filter((member) => member.isWorkingToday);
				const membersNotWorkingToday = members.filter((member) => !member.isWorkingToday);
				allMembers.push(...members);
				allMembersWorking.push(...membersWorkingToday);
				return {
					...team,
					members: this._uniques(members),
					membersWorkingToday: this._uniques(membersWorkingToday),
					membersNotWorkingToday: this._uniques(membersNotWorkingToday),
					membersOnline: this._uniques(membersOnline),
					statistics: {
						countOnline: membersOnline.length,
						countWorking: membersWorkingToday.length,
						countNotWorking: membersNotWorkingToday.length,
						countTotal: members.length
					}
				};
			})
			.filter((team) => !!team);

		projects = this._uniques(projects);
		allMembers = this._uniques(allMembers);
		allMembersWorking = this._uniques(allMembersWorking);
		this.request['employeeIds'] = Object.keys(this._groupBy('employeeId', allMembers));
		await this.getCounts();
		this._countsStatistics = {
			...this._countsStatistics,
			projectsCount: projects.length,
			employeesCount: allMembersWorking.length,
			employeesCountTotal: allMembers.length
		};
		this._buildRows();
		this.isLoading = false;
	}

	private async getCounts() {
		if (!this.organization) {
			return;
		}
		const request: IGetCountsStatistics = {
			...this.getFilterRequest(this.request)
		};
		try {
			this._countsStatistics = await this._timesheetStatisticsService.getCounts(request);
		} catch (error) {
			console.log(error);
		}
	}

	/** Derives every table and strip of the page from the mapped teams, once per load. */
	private _buildRows(): void {
		this.teamRows = this._todayTeamsWorkers.map((team) => {
			const members: any[] = team.members;
			const working = members.filter((member) => member.isWorkingToday);
			const projectList = this._projectsOf(working, team.projects ?? []);
			return {
				id: team.id,
				name: team.name,
				initials: initialsOf(team.name),
				color: team.color || null,
				logoUrl: team.image?.fullUrl || team.image?.url || team.logo || null,
				isPublic: !!team.public,
				prefix: team.prefix || null,
				total: members.length,
				worked: working.length,
				notWorked: members.length - working.length,
				tracking: members.filter((member) => presenceOf(member.employee, member.isRunningTimer) === 'tracking')
					.length,
				online: members.filter((member) => presenceOf(member.employee, member.isRunningTimer) !== 'offline')
					.length,
				duration: working.reduce((total, member) => total + (member.todayWorkDuration || 0), 0),
				// From the team's own slots, weighted by time — not an average of members' whole-day figures.
				activity: activityOf(working.flatMap((member) => member.slots ?? [])) ?? 0,
				projects: projectList.filter((project) => project.duration > 0).length,
				projectList,
				managers: members
					.filter((member) => this._isManager(member))
					.map((member) => member.employee?.user?.name)
					.filter(Boolean)
			};
		});

		// A person on several teams counts once across the organization, with the time of every
		// team added up (each team's figure only holds that team's logs). The label names the team
		// with the largest share of the day.
		const people = new Map<string, any>();
		for (const team of this._todayTeamsWorkers) {
			for (const member of team.members) {
				const duration = member.todayWorkDuration || 0;
				const known = people.get(member.employeeId);
				if (!known) {
					people.set(member.employeeId, { ...member, teamName: team.name, teamDuration: duration });
					continue;
				}
				const isLargerShare = duration > known.teamDuration;
				// Across teams as within one: a running task wins, then the later start.
				const isLaterTask =
					(member.latestTaskRunning && !known.latestTaskRunning) ||
					(!!member.latestTaskRunning === !!known.latestTaskRunning &&
						(member.latestTaskAt || 0) > (known.latestTaskAt || 0));
				people.set(member.employeeId, {
					...known,
					todayWorkDuration: (known.todayWorkDuration || 0) + duration,
					isWorkingToday: known.isWorkingToday || member.isWorkingToday,
					isRunningTimer: known.isRunningTimer || member.isRunningTimer,
					// The displayed team and the person's role in it always come from the same membership.
					teamName: isLargerShare ? team.name : known.teamName,
					teamDuration: isLargerShare ? duration : known.teamDuration,
					role: isLargerShare ? member.role : known.role,
					isManager: isLargerShare ? member.isManager : known.isManager,
					tasks: this._mergeTasks(known.tasks, member.tasks),
					latestTask: isLaterTask ? member.latestTask : known.latestTask,
					latestTaskAt: isLaterTask ? member.latestTaskAt : known.latestTaskAt,
					latestTaskRunning: isLaterTask ? member.latestTaskRunning : known.latestTaskRunning
				});
			}
		}
		const worked = [...people.values()].filter((member) => member.isWorkingToday);
		const ranked = [...worked].sort((a, b) => b.todayWorkDuration - a.todayWorkDuration).slice(0, TOP_MEMBERS_LIMIT);
		const top = ranked[0]?.todayWorkDuration || 0;
		this.topMembers = ranked.map((member) => ({
			id: member.id,
			employeeId: member.employeeId,
			// The whole day across teams: summed time, every task, the day's own activity.
			person: this._personOf(member, member.teamName, member.dayActivity),
			name: member.employee?.user?.name,
			// The whole day across teams, matching the summed duration.
			meta: `${member.teamName} · ${formatPercent(member.dayActivity)}`,
			duration: member.todayWorkDuration,
			width: toPercentage(member.todayWorkDuration, top)
		}));

		this.overviewProjects = this._projectsOf(
			this._todayTeamsWorkers.flatMap((team) => team.members),
			this._todayTeamsWorkers.flatMap((team) => team.projects ?? [])
		);

		this.overview = {
			teamsWorked: this.teamRows.filter((row) => row.worked > 0).length,
			membersWorked: worked.length,
			membersTotal: people.size,
			// From the list it opens, so the figure and the list always agree.
			projectsWorked: this.overviewProjects.filter((project) => project.duration > 0).length,
			duration: worked.reduce((total, member) => total + (member.todayWorkDuration || 0), 0),
			// The statistics API's figure for the day, as the dashboard has always shown it.
			activity: Number(this._countsStatistics?.weekActivities) || 0
		};

		this.membersByTeam = Object.fromEntries(
			this._todayTeamsWorkers.map((team) => [team.id, this._memberRowsOf(team)])
		);

		// Keep the open team across a reload when it is still listed.
		if (this.selectedTeamId && !this.teamRows.some((row) => row.id === this.selectedTeamId)) {
			this.selectedTeamId = null;
		}
		this._buildMemberRows();
		setTimeout(() => this.updateTabsScroll());
	}

	/**
	 * A team's projects — `linked`, the projects linked to the team — with the time `members`
	 * logged on each during the selected day and how many of them did, plus any project they
	 * logged time on without it being linked, as the team page shows it. Worked projects come
	 * first, longest first, then the rest by name.
	 *
	 * Each log belongs to one team, so adding every membership's time counts no time twice; a
	 * person on several teams still counts once per project.
	 */
	private _projectsOf(members: any[], linked: any[]): IProjectWorked[] {
		let byProject = new Map<string, { project: any; duration: number; people: Set<string>; isLinked: boolean }>();
		for (const project of linked) {
			if (project?.id && !byProject.has(project.id)) {
				byProject.set(project.id, { project, duration: 0, people: new Set<string>(), isLinked: true });
			}
		}
		for (const member of members) {
			for (const { project, duration } of member.projectTimes ?? []) {
				let entry = byProject.get(project.id) ?? { project, duration: 0, people: new Set<string>(), isLinked: false };
				entry.duration += duration;
				entry.people.add(member.employeeId);
				byProject.set(project.id, entry);
			}
		}
		const list = [...byProject.values()].sort(
			(a, b) => b.duration - a.duration || (a.project.name || '').localeCompare(b.project.name || '')
		);
		const top = list[0]?.duration || 0;
		return list.map(({ project, duration, people, isLinked }) => ({
			id: project.id,
			name: project.name || '',
			imageUrl: project.image?.fullUrl || project.imageUrl || null,
			initials: initialsOf(project.name || ''),
			duration,
			members: people.size,
			width: toPercentage(duration, top),
			isLinked
		}));
	}

	private _buildMemberRows(): void {
		this.memberRows = (this.selectedTeamId && this.membersByTeam[this.selectedTeamId]) || [];
	}

	/**
	 * A team member as their hover card shows them: who they are, read the way the
	 * team page reads an assignee, and their selected day on `teamName`.
	 */
	private _personOf(member: any, teamName: string | null, activity: number | null): ITeamPerson {
		const employee = member.employee;
		const user = employee?.user;
		return {
			employeeId: member.employeeId,
			name: user?.name || '',
			avatarUrl: avatarOf(user?.image?.fullUrl || user?.imageUrl),
			presence: presenceOf(employee, member.isRunningTimer),
			email: user?.email || null,
			bio: employee?.short_description?.trim() || null,
			since: employee?.startedWorkOn ? moment(employee.startedWorkOn).format('ll') : null,
			teamName,
			isManager: this._isManager(member),
			timeZone: user?.timeZone || null,
			day: this._dayOf(member, activity)
		};
	}

	private _dayOf(member: any, activity: number | null): ITeamPersonDay {
		const tasks: any[] = member.tasks ?? [];
		const duration = member.todayWorkDuration || 0;
		const workPeriod = member.workPeriod || this._period;
		return {
			duration,
			activity: member.isWorkingToday && activity !== null && activity !== undefined ? Number(activity) : null,
			tasksCount: tasks.length,
			workPeriod,
			workdayShare: toPercentage(duration, workPeriod),
			task: member.latestTask ?? null
		};
	}

	/**
	 * The log a member is on now, or was on last: a running log wins, then the latest start.
	 * Does not rely on the order the logs arrive in.
	 */
	private _latestLog(logs: ITimeLog[]): ITimeLog | null {
		let latest: ITimeLog | null = null;
		for (const log of logs) {
			if (
				!latest ||
				(log.isRunning && !latest.isRunning) ||
				(!!log.isRunning === !!latest.isRunning && this._logTime(log) > this._logTime(latest))
			) {
				latest = log;
			}
		}
		return latest;
	}

	private _logTime(log: ITimeLog): number {
		const time = new Date(log?.startedAt as any).getTime();
		return Number.isNaN(time) ? 0 : time;
	}

	/**
	 * One person's tasks across their teams: the same task logged under two teams is
	 * one task, its durations added — so the hover card does not count it twice.
	 */
	private _mergeTasks(first: any[] = [], second: any[] = []): any[] {
		const byTask = new Map<string, any>();
		for (const task of [...first, ...second]) {
			const key = task?.id ?? 'no-task';
			const known = byTask.get(key);
			byTask.set(key, known ? { ...known, duration: (known.duration || 0) + (task.duration || 0) } : { ...task });
		}
		return [...byTask.values()].sort((a, b) => (b.duration || 0) - (a.duration || 0));
	}

	private _memberRowsOf(team: any): IMemberRow[] {
		return (team.members as any[])
			.map((member) => {
				const user = member.employee?.user;
				const workPeriod = member.workPeriod || this._period;
				const duration = member.todayWorkDuration || 0;
				return {
					...this._personOf(member, team.name, member.activity),
					id: member.id,
					caption: member.employee?.organizationPosition?.name || user?.email || null,
					isManager: this._isManager(member),
					isWorking: !!member.isWorkingToday,
					tasks: (member.tasks ?? []).map((task, index) => {
						const estimate = Number(task?.estimate) || 0;
						return {
							key: task?.id || `no-task-${index}`,
							title: task?.title || null,
							projectName: task?.project?.name || null,
							duration: task?.duration || 0,
							estimate,
							estimateShare: toPercentage(task?.duration || 0, estimate),
							isOverEstimate: estimate > 0 && (task?.duration || 0) > estimate
						};
					}),
					duration,
					activity: member.activity || 0,
					workPeriod,
					workdayShare: toPercentage(duration, workPeriod)
				} as IMemberRow;
			})
			.sort(
				(a, b) =>
					PRESENCE_RANK[a.presence] - PRESENCE_RANK[b.presence] ||
					b.duration - a.duration ||
					a.name.localeCompare(b.name)
			);
	}

	/**
	 * A team manager: the membership flag, or the legacy Manager role — the same rule as
	 * `OrganizationTeamEmployeeService.findMemberSets()`.
	 */
	private _isManager(member: any): boolean {
		return member?.isManager === true || member?.role?.name === RolesEnum.MANAGER;
	}

	private _clearItem() {
		this.request = {};
	}

	private _groupBy(searchId: string, array: any[]): any[] {
		return array.reduce((res, e) => {
			(res[e[searchId]] = res[e[searchId]] || []).push(e);
			return res;
		}, {});
	}

	private _uniques(array: any[]) {
		return array.filter(
			(value, index, self) => index === self.findIndex((searchValue) => searchValue.id === value.id)
		);
	}
}
