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
	IRankedMember,
	ITeamPerson,
	ITeamPersonDay,
	ITeamRow,
	activityOf,
	activityTone,
	avatarOf,
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
			.getAll(['members', 'members.role', 'members.employee', 'members.employee.user'], {
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
					// This team's slots only, like the duration beside it; the daily report is grouped by
					// employee alone, so its figure spans every team the person worked on.
					const slots = logs.flatMap((log) => log.timeSlots ?? []);
					return {
						...member,
						isRunningTimer: isWorkingToday ? logs.reverse()[0].isRunning : false,
						todayWorkDuration,
						isWorkingToday: isWorkingToday,
						tasks: tasks,
						projects: proj,
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
				// Logs without a project group under an empty object: not a project worked.
				projects: this._uniques(working.flatMap((member) => member.projects ?? []).filter((project) => !!project?.id))
					.length,
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
				people.set(member.employeeId, {
					...known,
					todayWorkDuration: (known.todayWorkDuration || 0) + duration,
					isWorkingToday: known.isWorkingToday || member.isWorkingToday,
					isRunningTimer: known.isRunningTimer || member.isRunningTimer,
					teamName: isLargerShare ? team.name : known.teamName,
					teamDuration: isLargerShare ? duration : known.teamDuration,
					role: isLargerShare ? member.role : known.role,
					tasks: [...(known.tasks ?? []), ...(member.tasks ?? [])]
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

		this.overview = {
			teamsWorked: this.teamRows.filter((row) => row.worked > 0).length,
			membersWorked: worked.length,
			membersTotal: people.size,
			projectsWorked: this._countsStatistics?.projectsCount || 0,
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
		const [task] = [...tasks].sort((a, b) => (b?.duration || 0) - (a?.duration || 0));
		return {
			duration,
			activity: member.isWorkingToday && activity !== null && activity !== undefined ? Number(activity) : null,
			tasksCount: tasks.length,
			workPeriod,
			workdayShare: toPercentage(duration, workPeriod),
			task: task ? { title: task.title || null, projectName: task.project?.name || null } : null
		};
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
