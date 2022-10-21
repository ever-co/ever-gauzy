import { Component, OnDestroy, OnInit } from '@angular/core';
import {
    IOrganizationTeam,
    IOrganizationTeamEmployee,
    ITimeLog,
    ITimeLogFilters
} from "@gauzy/contracts";
import { debounceTime, tap } from "rxjs";
import { UntilDestroy, untilDestroyed } from "@ngneat/until-destroy";
import { TranslateService } from '@ngx-translate/core';
import {
    DateRangePickerBuilderService,
    OrganizationTeamsService,
    Store
} from "../../../@core/services";
import { TimesheetService } from "../../../@shared/timesheet";
import { BaseSelectorFilterComponent } from '../../../@shared/timesheet/gauzy-filters/base-selector-filter/base-selector-filter.component';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'gauzy-teams',
    templateUrl: './team.component.html',
    styleUrls: ['./team.component.scss']
})
export class TeamComponent extends BaseSelectorFilterComponent implements OnInit, OnDestroy {

    private _logs: ITimeLog[] = [];

    constructor(
        private readonly _organizationTeamsService: OrganizationTeamsService,
        private readonly _timesheetService: TimesheetService,
        protected readonly _dateRangePickerBuilderService: DateRangePickerBuilderService,
        protected readonly _store: Store,
        protected readonly _translateService: TranslateService,
    ) {
        super(_store, _translateService, _dateRangePickerBuilderService);
        this._selectedTeam = {
            data: null,
            isSelected: false
        };
    }

    private _todayTeamsWorkers: any[] = [];

    public get todayTeamsWorkers(): any[] {
        return this._todayTeamsWorkers;
    }

    private _selectedTeam: {
        data: IOrganizationTeam,
        isSelected: boolean
    };

    public get selectedTeam(): any {
        return this._selectedTeam;
    }

    private _teams: IOrganizationTeam[] = [];

    public get teams(): IOrganizationTeam[] {
        return this._teams;
    }

    public get members(): IOrganizationTeamEmployee[] {
        const membersDuplicatedByRoles = this.selectedTeam.data.membersWorkingToday.concat(this.selectedTeam.data.membersNotWorkingToday);
        return membersDuplicatedByRoles.filter((member, index, self) => index === self.findIndex((searchMember) => searchMember.id === member.id));
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
    }

    ngOnDestroy(): void {}

    public select(team: IOrganizationTeam) {
        this._selectedTeam =
            this._selectedTeam.data && team.id === this._selectedTeam.data.id
            ? {isSelected: !this._selectedTeam.isSelected, data: team}
            : {isSelected: true, data: team};
    }

    private async getTimeLogs() {
        if (!this.organization) {
            return;
        }
        const request: ITimeLogFilters = {
            ...this.getFilterRequest(this.request)
        };
        try {
            this._logs = await this._timesheetService.getTimeLogs(request);
            this._logs = this._logs.sort(
                (a, b) => this._sortByIdAndDate(a, b)
            );
            this.teamMapper();
        } catch (error) {
            console.log(error);
        } finally {

        }
    }

    public fnTracker = (index: number, item: IOrganizationTeam) => {
        return item.id;
    }

    private _loadTeams(): void {
        if (!this.organization) {
            return;
        }
        const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;

        this._organizationTeamsService.getAll(
            [
                'members',
                'members.role',
                'members.employee',
                'members.employee.user'
            ],
            {
                organizationId,
                tenantId
            }
        ).then(async (res) => {
            this._teams = res.items;
            await this.getTimeLogs();
        }).catch((e) => console.error(e));
    }

    private teamMapper() {
        this._todayTeamsWorkers = this._teams.map(team => {
            const members = team.members.map(member => {
                const logs = this._logs
                    .map(log => log.employee.userId === member.employee.userId ? log : null)
                    .filter(log => !!log)
                const isWorkingToday = logs.length > 0;
                const groupByTask = isWorkingToday ? logs.reduce((res, log) => {
                    (res[log['taskId']] = res[log['taskId']] || []).push(log);
                    return res
                }, {}) : [];
                const keys = Object.keys(groupByTask);
                const tasks = keys.map(key => {
                    return {
                        ...groupByTask[key][0].task,
                        duration: groupByTask[key].reduce((accumulator, log) => {
                            return accumulator + log.duration
                        }, 0)
                    }
                })
                return {
                    ...member,
                    isRunningTimer: isWorkingToday ? logs[0].isRunning : false,
                    isWorkingToday: isWorkingToday,
                    tasks: tasks
                }
            })
            const membersOnline = members.filter((member) => member.isRunningTimer);
            const membersWorkingToday = members.filter(member => member.isWorkingToday);
            const membersNotWorkingToday = members.filter(member => !member.isWorkingToday)
            return {
                ...team,
                membersWorkingToday: membersWorkingToday,
                membersNotWorkingToday: membersNotWorkingToday,
                membersOnline: membersOnline,
                statistics: {
                    countOnline: membersOnline.length,
                    countWorking: membersWorkingToday.length,
                    countNotWorking: membersNotWorkingToday.length,
                    countTotal: members.length,
                }
            }
        });
    }

    private _sortByIdAndDate(a, b) {
        return (
            a.employeeId.localeCompare(b.employeeId) ||
            new Date(b.createdAt).getTime() -
            new Date(a.createdAt).getTime()
        );
    }

    private _clearItem() {
        this._selectedTeam = {
            data: null,
            isSelected: false
        }
    }

    public get todayOrganization() {
        return {
            ...this.organization,
            statistics: {
                countOnline: this._todayTeamsWorkers.reduce((accumulator, res) => {
                    const teamsOnline = res.statistics.countOnline > 0 ? 1 : 0
                    return accumulator + teamsOnline;
                }, 0),
                countWorking: this._todayTeamsWorkers.reduce((accumulator, res) => {
                    const teamsWorking = res.statistics.countWorking > 0 ? 1 : 0;
                    return accumulator + teamsWorking;
                }, 0),
                countNotWorking: this._todayTeamsWorkers.reduce((accumulator, res) => {
                    const teamsNotWorking = res.statistics.countNotWorking > 0 && res.statistics.countWorking === 0 ? 1 : 0;
                    return accumulator + teamsNotWorking;
                }, 0),
                countTeams: this._teams.length
            }
        }
    }

}
