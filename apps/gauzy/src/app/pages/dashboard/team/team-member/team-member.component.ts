import { Component, Input, OnInit } from '@angular/core';
import { IOrganizationTeamEmployee } from "@gauzy/contracts";
import { progressStatus } from 'packages/common-angular/dist/utils/shared-utils';
import { TimesheetStatisticsService } from "../../../../@shared/timesheet";

@Component({
    selector: 'gauzy-team-member',
    templateUrl: './team-member.component.html',
    styleUrls: ['./team-member.component.scss']
})
export class TeamMemberComponent implements OnInit {
    constructor(
        private readonly _timesheetStatisticsService: TimesheetStatisticsService
    ) {
    }

    private _member: IOrganizationTeamEmployee | any

    public get member(): IOrganizationTeamEmployee | any {
        return this._member;
    }

    @Input()
    public set member(value: IOrganizationTeamEmployee | any) {
        this._member = value;
    }

    public progressStatus(value) {
        return progressStatus(value);
    }

    ngOnInit(): void {
    }
}
