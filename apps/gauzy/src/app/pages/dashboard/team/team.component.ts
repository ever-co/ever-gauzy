import { Component, OnDestroy, OnInit } from '@angular/core';
import * as moment from 'moment';
import { combineLatest, debounceTime, tap } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { DateRangePickerBuilderService } from '@gauzy/ui-sdk/core';
import {
	IGetCountsStatistics,
	IGetTimeLogReportInput,
	IOrganizationTeam,
	IOrganizationTeamEmployee,
	ISelectedEmployee,
	ITimeLog,
	ReportGroupFilterEnum
} from '@gauzy/contracts';
import { OrganizationTeamsService, Store } from '../../../@core/services';
import { TimesheetService, TimesheetStatisticsService } from '../../../@shared/timesheet';
import { BaseSelectorFilterComponent } from '../../../@shared/timesheet/gauzy-filters/base-selector-filter/base-selector-filter.component';
import { TimeZoneService } from '../../../@shared/timesheet/gauzy-filters/timezone-filter';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gauzy-teams',
	templateUrl: './team.component.html',
	styleUrls: ['./team.component.scss']
})
export class TeamComponent extends BaseSelectorFilterComponent implements OnInit, OnDestroy {
	private _logs: ITimeLog[] = [];
	private _countsStatistics: any;
	private _dailyLogs: any[] = [];
	private _selectedEmployee: ISelectedEmployee;
	private _selectedOrganizationTeam: IOrganizationTeam;

	constructor(
		private readonly _organizationTeamsService: OrganizationTeamsService,
		private readonly _timesheetStatisticsService: TimesheetStatisticsService,
		private readonly _timesheetService: TimesheetService,
		protected readonly translateService: TranslateService,
		protected readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		protected readonly store: Store,
		protected readonly timeZoneService: TimeZoneService
	) {
		super(store, translateService, dateRangePickerBuilderService, timeZoneService);
		this._selectedTeam = {
			data: null,
			isSelected: false
		};
		this._isLoading = false;
		this._selectedOrganizationTeam = null;
	}

	private _isLoading: boolean;

	get isLoading(): boolean {
		return this._isLoading;
	}

	set isLoading(value: boolean) {
		this._isLoading = value;
	}

	private _selectedTeam: {
		data: IOrganizationTeam;
		isSelected: boolean;
	};

	public get selectedTeam(): any {
		return this._selectedTeam;
	}

	private _todayTeamsWorkers: any[] = [];

	public get todayTeamsWorkers(): any[] {
		return this._todayTeamsWorkers;
	}

	private _teams: IOrganizationTeam[] = [];

	public get teams(): IOrganizationTeam[] {
		return this._teams;
	}

	public get members(): IOrganizationTeamEmployee[] {
		const membersDuplicatedByRoles = this.selectedTeam.data.membersWorkingToday.concat(
			this.selectedTeam.data.membersNotWorkingToday
		);
		return membersDuplicatedByRoles.filter(
			(member, index, self) => index === self.findIndex((searchMember) => searchMember.id === member.id)
		);
	}

	public get todayOrganization() {
		return {
			...this.organization,
			statistics: {
				countOnline: this._todayTeamsWorkers.reduce((accumulator, res) => {
					const teamsOnline = res.statistics.countOnline > 0 ? 1 : 0;
					return accumulator + teamsOnline;
				}, 0),
				countWorking: this._todayTeamsWorkers.reduce((accumulator, res) => {
					const teamsWorking = res.statistics.countWorking > 0 ? 1 : 0;
					return accumulator + teamsWorking;
				}, 0),
				countNotWorking: this._todayTeamsWorkers.reduce((accumulator, res) => {
					const teamsNotWorking =
						res.statistics.countNotWorking > 0 && res.statistics.countWorking === 0 ? 1 : 0;
					return accumulator + teamsNotWorking;
				}, 0),
				countTeams: this._teams.length,
				counts: this._countsStatistics
			}
		};
	}

	private get _period() {
		const endWork = moment(this.organization.defaultEndTime, 'HH:mm');
		const startWork = moment(this.organization.defaultStartTime, 'HH:mm');
		const duration = endWork.diff(startWork) / 1000;
		return isNaN(duration) ? 86400 : duration;
	}

	ngOnDestroy(): void {}

	public select(team: IOrganizationTeam) {
		this._selectedTeam =
			this._selectedTeam.data && team.id === this._selectedTeam.data.id
				? { isSelected: !this._selectedTeam.isSelected, data: team }
				: { isSelected: true, data: team };
	}

	ngOnInit(): void {
		this.subject$
			.pipe(
				debounceTime(100),
				tap(() => this._clearItem()),
				tap(() => this._loadTeams()),
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

	public fnTracker = (index: number, item: IOrganizationTeam) => {
		return item.id;
	};

	private _loadTeams(): void {
		if (!this.organization) {
			return;
		}
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;
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
			.catch((e) => console.error(e));
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
			console.log(error);
		} finally {
		}
	}

	private async teamMapper() {
		let projects = [];
		let allMembers = [];
		let allMembersWorking = [];
		this._todayTeamsWorkers = this._teams
			.map((team) => {
				const isTeamMember = team.members.some((member) => member.employeeId === this._selectedEmployee.id);
				if (
					(!isTeamMember && this._selectedEmployee?.id) ||
					(this._selectedOrganizationTeam.id && team.id !== this._selectedOrganizationTeam.id)
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
					const tasks = taskKeys.map((value: string) => {
						return {
							...groupByTask[value][0].task,
							duration: groupByTask[value].reduce((accumulator, log) => {
								return accumulator + log.duration;
							}, 0)
						};
					});
					const todayWorkDuration = tasks.reduce((accumulator: number, task) => {
						return accumulator + task?.duration || 0;
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

	private _sortByIdAndDate(a, b) {
		return (
			a.employeeId.localeCompare(b.employeeId) ||
			new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
		);
	}

	private _clearItem() {
		this._selectedTeam = {
			data: null,
			isSelected: false
		};
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

	public reset() {
		this._clearItem();
	}
}
