import { Component, OnInit, OnDestroy } from '@angular/core';
import { Store } from '../../@core/services/store.service';
import { OrganizationsService } from '../../@core/services/organizations.service';
import { first, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

@Component({
    templateUrl: './employees.component.html',
    styleUrls: ['./employees.component.scss'],
})
export class EmployeesComponent implements OnInit, OnDestroy {
    organizationName: string;

    private _ngDestroy$ = new Subject<void>();

    constructor(
        private organizationsService: OrganizationsService,
        private store: Store
    ) { }

    ngOnInit(): void {
        const selectedId = this.store.selectedOrganizationId;
        
        if (selectedId) {
            this.loadPage(selectedId);
        }

        this.store.selectedOrganizationId$
            .pipe(takeUntil(this._ngDestroy$))
            .subscribe((id) => this.loadPage(id));
    }

    private async loadPage(id: string) {
        const { name } = await this.organizationsService
            .getById(id)
            .pipe(first())
            .toPromise()

        this.organizationName = name;
    }

    ngOnDestroy() {
        this._ngDestroy$.next();
        this._ngDestroy$.complete();
    }
}