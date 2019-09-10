import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, first } from 'rxjs/operators';
import { Store } from '../../../@core/services/store.service';
import { Organization } from '@gauzy/models';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { EmployeesService } from '../../../@core/services';


@Component({
    templateUrl: './edit-organization.component.html',
    styleUrls: [
        './edit-organization.component.scss',
        '../../dashboard/dashboard.component.scss'
    ]
})
export class EditOrganizationComponent implements OnInit, OnDestroy {
    private _ngDestroy$ = new Subject<void>();
    selectedOrg: Organization;
    selectedDate: Date;
    selectedOrgFromHeader: Organization;
    employeesCount: number;

    constructor(private route: ActivatedRoute,
        private router: Router,
        private organizationsService: OrganizationsService,
        private employeesService: EmployeesService,
        private store: Store,
    ) { }

    async ngOnInit() {
        this.selectedDate = this.store.selectedDate;

        this.store.selectedDate$
            .pipe(takeUntil(this._ngDestroy$))
            .subscribe(date => {
                this.selectedDate = date;
            });

        this.route.params
            .pipe(takeUntil(this._ngDestroy$))
            .subscribe(async params => {
                const id = params.id;

                this.selectedOrg = await this.organizationsService.getById(id).pipe(first()).toPromise();
                this.selectedOrgFromHeader = this.selectedOrg;
                this.loadEmployeesCount();
                this.store.selectedOrganization = this.selectedOrg;

                this.store.selectedOrganization$
                    .pipe(takeUntil(this._ngDestroy$))
                    .subscribe(org => {
                        this.selectedOrgFromHeader = org;
                        if (org && org.id) {
                            this.router.navigate(['/pages/organizations/edit/' + org.id]);
                        }
                    });
            });
    }

    editOrg() {
        this.router.navigate(['/pages/organizations/edit/' + this.selectedOrg.id + '/settings']);
    }

    addOrgRecurringExpense() {
        console.warn("TODO add expense");
    }

    ngOnDestroy() {
        this._ngDestroy$.next();
        this._ngDestroy$.complete();
    }

    private async loadEmployeesCount() {
        const { total } = await this.employeesService.getAll(
            [], { organization: { id: this.selectedOrg.id } }).pipe(first()).toPromise();

        this.employeesCount = total;
    }
}
