import {Component, OnChanges, OnInit, SimpleChanges} from '@angular/core';
import { DefaultFilter } from 'ng2-smart-table';
import { Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest } from 'rxjs';
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
    selectedEmployee: ISelectedEmployee;
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
                debounceTime(100),
                tap(() => this.getTeams()),
                untilDestroyed(this)
            )
            .subscribe();
        const storeOrganization$ = this.store.selectedOrganization$;
        const storeEmployee$ = this.store.selectedEmployee$;
        combineLatest([storeOrganization$, storeEmployee$])
            .pipe(
                debounceTime(300),
                filter(([organization, employee]) => !!organization && !!employee),
                distinctUntilChange(),
                tap(([organization, employee]) => {
                    this.organization = organization;
                    this.selectedEmployee = employee;
                }),
                tap(() => this.subject$.next()),
                untilDestroyed(this)
            )
            .subscribe();
    }

    ngOnChanges(changes: SimpleChanges) {}

    onChange(event) {
        this.column.filterFunction(event);
    }

    async getTeams() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

        let employeeId: string;
		if (this.selectedEmployee.id) {
			employeeId = this.selectedEmployee.id;
		}
        
		const { items = [] } = await this.organizationTeamsService.getMyTeams(
			['members'],
			{ organizationId, tenantId },
			employeeId
		);
		this.teams = items;
	}
}