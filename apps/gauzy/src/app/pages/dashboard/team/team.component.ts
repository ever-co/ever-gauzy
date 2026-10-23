import { Component, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
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
	ITeamRow,
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
	styleUrls: ['../../employees/view-employee/view-employee.component.scss', './team.component.scss'],
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

	/** `null` shows "All teams"; otherwise the id of the open team. */
	public selectedTeamId: string | null = null;

	public teamRows: ITeamRow[] = [];
	public memberRows: IMemberRow[] = [];
	public topMembers: IRankedMember[] = [];
	public projectCount = 0;

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
		private readonly _errorHandlingService: ErrorHandlingService
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

	ngOnDestroy(): void {}

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
		try {
			this.projectCount = await this._organizationProjectsService.getCount({ organizationId, tenantId });
		} catch (e) {
			this.projectCount = 0;
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
			this._logs = await this._timesheetService.getTimeLogs(request, ['project', 'task', 'employee.user']);
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
					return {
						...member,
						isRunningTimer: isWorkingToday ? logs.reverse()[0].isRunning : false,
						todayWorkDuration,
						isWorkingToday: isWorkingToday,
						tasks: tasks,
						projects: proj,
						workPeriod: this._period,
						activity: memberDailyLog ? memberDailyLog.activity : null
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
				tracking: members.filter((member) => presenceOf(member.employee, member.isRunningTimer) === 'tracking')
					.length,
				online: members.filter((member) => presenceOf(member.employee, member.isRunningTimer) !== 'offline')
					.length,
				duration: working.reduce((total, member) => total + (member.todayWorkDuration || 0), 0),
				activity: this._average(working.map((member) => member.activity || 0)),
				projects: this._uniques(working.flatMap((member) => member.projects ?? [])).length,
				share: toPercentage(working.length, members.length),
				managers: members
					.filter((member) => member.role?.name === RolesEnum.MANAGER)
					.map((member) => member.employee?.user?.name)
					.filter(Boolean)
			};
		});

		// A person on several teams counts once across the organization.
		const people = new Map<string, any>();
		for (const team of this._todayTeamsWorkers) {
			for (const member of team.members) {
				const known = people.get(member.employeeId);
				if (!known || (member.todayWorkDuration || 0) > (known.todayWorkDuration || 0)) {
					people.set(member.employeeId, { ...member, teamName: team.name });
				}
			}
		}
		const worked = [...people.values()].filter((member) => member.isWorkingToday);
		const ranked = [...worked].sort((a, b) => b.todayWorkDuration - a.todayWorkDuration).slice(0, TOP_MEMBERS_LIMIT);
		const top = ranked[0]?.todayWorkDuration || 0;
		this.topMembers = ranked.map((member) => ({
			id: member.id,
			employeeId: member.employeeId,
			name: member.employee?.user?.name,
			meta: `${member.teamName} · ${formatPercent(member.activity)}`,
			duration: member.todayWorkDuration,
			width: toPercentage(member.todayWorkDuration, top)
		}));

		this.overview = {
			teamsWorked: this.teamRows.filter((row) => row.worked > 0).length,
			membersWorked: worked.length,
			membersTotal: people.size,
			projectsWorked: this._countsStatistics?.projectsCount || 0,
			duration: worked.reduce((total, member) => total + (member.todayWorkDuration || 0), 0),
			activity: this._average(worked.map((member) => member.activity || 0))
		};

		// Keep the open team across a reload when it is still listed.
		if (this.selectedTeamId && !this.teamRows.some((row) => row.id === this.selectedTeamId)) {
			this.selectedTeamId = null;
		}
		this._buildMemberRows();
	}

	private _buildMemberRows(): void {
		const team = this._todayTeamsWorkers.find((item) => item.id === this.selectedTeamId);
		if (!team) {
			this.memberRows = [];
			return;
		}
		this.memberRows = (team.members as any[])
			.map((member) => {
				const user = member.employee?.user;
				const [task] = member.tasks ?? [];
				return {
					id: member.id,
					employeeId: member.employeeId,
					name: user?.name || '',
					caption: member.employee?.organizationPosition?.name || user?.email || null,
					avatarUrl: avatarOf(user?.imageUrl),
					initials: initialsOf(user?.name),
					presence: presenceOf(member.employee, member.isRunningTimer),
					isManager: member.role?.name === RolesEnum.MANAGER,
					isWorking: !!member.isWorkingToday,
					taskTitle: task ? task.title || null : null,
					projectName: task?.project?.name || null,
					moreTasks: Math.max((member.tasks?.length ?? 0) - 1, 0),
					duration: member.todayWorkDuration || 0,
					activity: member.activity || 0
				} as IMemberRow;
			})
			.sort(
				(a, b) =>
					PRESENCE_RANK[a.presence] - PRESENCE_RANK[b.presence] ||
					b.duration - a.duration ||
					a.name.localeCompare(b.name)
			);
	}

	private _average(values: number[]): number {
		return values.length ? Math.round(values.reduce((total, value) => total + value, 0) / values.length) : 0;
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
