import {Component, OnChanges, OnInit, SimpleChanges} from '@angular/core';
import { DefaultFilter } from 'ng2-smart-table';
import { combineLatest, Subject } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IOrganization, IOrganizationTeam, ISelectedEmployee } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/common-angular';
import { OrganizationTeamsService, Store } from '../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
    template: `
        <ng-select
            [clearable]="true"
            [closeOnSelect]="true"
            [placeholder]="'TASKS_PAGE.SELECT' | translate"
            (change)="onChange($event)"
        >
            <ng-option *ngFor="let team of teams" [value]="team">
                {{ team.name }}
            </ng-option>
        </ng-select>
    `,
})
export class OrganizationTeamFilterComponent extends DefaultFilter implements OnInit, OnChanges {

    teams: IOrganizationTeam[] = [];
    organization: IOrganization;
    selectedEmployeeId: ISelectedEmployee['id'];
	subject$: Subject<any> = new Subject();

    constructor(
        private readonly store: Store,
        private readonly organizationTeamsService: OrganizationTeamsService
    ) {
        super();
    }

    ngOnInit() {
        this.subject$
            .pipe(
                tap(() => this.getTeams()),
                untilDestroyed(this)
            )
            .subscribe();
        const storeOrganization$ = this.store.selectedOrganization$;
        const storeEmployee$ = this.store.selectedEmployee$;
        combineLatest([storeOrganization$, storeEmployee$])
            .pipe(
                distinctUntilChange(),
                filter(([organization]) => !!organization),
                tap(([organization, employee]) => {
                    this.organization = organization;
					this.selectedEmployeeId = employee ? employee.id : null;
                }),
                tap(() => this.subject$.next(true)),
                untilDestroyed(this)
            )
            .subscribe();
    }

    ngOnChanges(changes: SimpleChanges) {}

    onChange(event: any) {
        this.column.filterFunction(event);
    }

    async getTeams() {
        if (!this.organization) {
            return;
        }
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const { items = [] } = await this.organizationTeamsService.getMyTeams(
			{
                organizationId,
				tenantId,
				...(this.selectedEmployeeId
					?   {
                            members: {
                                employeeId: this.selectedEmployeeId
                            }
					    }
					: {}),
            }
		);
		this.teams = items;
	}
}