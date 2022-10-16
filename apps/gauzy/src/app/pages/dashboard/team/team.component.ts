import { Component, OnDestroy, OnInit } from '@angular/core';
import {
    IDateRangePicker,
    IGetTimeSlotStatistics,
    IOrganization,
    IOrganizationTeam,
    IOrganizationTeamEmployee,
    ITimeLog
} from "@gauzy/contracts";
import { DateRangePickerBuilderService, OrganizationTeamsService, Store } from "../../../@core";
import { combineLatest, debounceTime, distinctUntilChanged, Subject, tap } from "rxjs";
import { filter } from "rxjs/operators";
import { UntilDestroy, untilDestroyed } from "@ngneat/until-destroy";
import { TimesheetService } from "../../../@shared/timesheet";
import { isNotEmpty } from "@gauzy/common-angular";
import * as moment from 'moment';

@UntilDestroy({checkProperties: true})
@Component({
    selector: 'gauzy-team',
    templateUrl: './team.component.html',
    styleUrls: ['./team.component.scss']
})
export class TeamComponent implements OnInit, OnDestroy {
    private _organization: IOrganization;
    private _teams$: Subject<any>;
    private _logs: ITimeLog[] = [];

    constructor(
        private readonly _organizationTeamsService: OrganizationTeamsService,
        private readonly _dateRangePickerBuilderService: DateRangePickerBuilderService,
        private readonly _timesheetService: TimesheetService,
        private readonly _store: Store
    ) {
        this._teams$ = new Subject();
        this._selectedTeam = {
            data: null,
            isSelected: false
        };
    }

    private _todayTeamsWorkers: any[] = [];

    public get todayTeamsWorkers(): any[] {
        return this._todayTeamsWorkers;
    }

    private _selectedDateRange: IDateRangePicker;

    public get selectedDateRange(): IDateRangePicker {
        return this._selectedDateRange;
    }

    public set selectedDateRange(range: IDateRangePicker) {
        if (isNotEmpty(range)) {
            this._selectedDateRange = range;
        }
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
        const selectedDateRange$ = this._dateRangePickerBuilderService.selectedDateRange$;
        const selectedOrganization$ = this._store.selectedOrganization$;
        this._teams$
            .pipe(
                debounceTime(300),
                tap(() => this._loadTeams()),
                untilDestroyed(this)
            )
            .subscribe();
        combineLatest([selectedOrganization$, selectedDateRange$])
            .pipe(
                debounceTime(300),
                distinctUntilChanged(),
                filter(([organization, dateRange]) => !!organization && !!dateRange),
                tap(([organization, dateRange]) => {
                    this._organization = organization;
                    this.selectedDateRange = dateRange;
                    this._teams$.next(true);
                }),
                tap(() => this._clear()),
                untilDestroyed(this)
            )
            .subscribe();
    }

    ngOnDestroy(): void {
    }

    public select(team: IOrganizationTeam) {
        this._selectedTeam =
            this._selectedTeam.data && team.id === this._selectedTeam.data.id
            ? {isSelected: !this._selectedTeam.isSelected, data: team}
            : {isSelected: true, data: team};
    }

    private async getTimeSlots() {
        const request: IGetTimeSlotStatistics = {
            endDate: moment(this.selectedDateRange.endDate).format('YYYY-MM-DD HH:mm'),
            organizationId: this._organization.id,
            startDate: moment(this.selectedDateRange.startDate).format('YYYY-MM-DD HH:mm'),
            tenantId: this._organization.tenantId
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

    public fnTracker = (index, item) => {
        return item.id;
    }

    private _loadTeams(): void {
        this._organizationTeamsService.getAll(
            [
                'tags',
                'members',
                'members.role',
                'members.employee',
                'members.employee.user',
                'members.employee.timeSlots',
                'members.employee.timeSlots.timeLogs'
            ],
            {
                organizationId: this._organization.id,
                tenantId: this._organization.tenantId
            }
        ).then(async (res) => {
            this._teams = res.items;
            await this.getTimeSlots();
        }).catch((e) => console.log(e));
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

    private _clear() {
        this._selectedTeam = {
            data: null,
            isSelected: false
        }
    }

}
