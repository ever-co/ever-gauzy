import { Component, OnInit, OnDestroy } from '@angular/core';
import { Store } from '../../@core/services/store.service';
import { OrganizationsService } from '../../@core/services/organizations.service';
import { first, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { LocalDataSource } from 'ng2-smart-table';
import { EmployeesService } from '../../@core/services/employees.service';
import { NbDialogService } from '@nebular/theme';
import { EmployeeMutationComponent } from '../../@shared/employee/employee-mutation/employee-mutation.component';
import { EmployeeEndWorkComponent } from '../../@shared/employee/employee-end-work-popup/employee-end-work.component';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { EmployeeBonusComponent } from './table-components/employee-bonus/employee-bonus.component';
import { EmployeeFullNameComponent } from './table-components/employee-fullname/employee-fullname';
import { Router } from '@angular/router';

interface EmployeeViewModel {
    fullName: string;
    email: string;
    bonus?: number;
    endWork?: any;
    id: string;
}

@Component({
    templateUrl: './employees.component.html',
    styleUrls: ['./employees.component.scss'],
})
export class EmployeesComponent implements OnInit, OnDestroy {
    organizationName: string;
    settingsSmartTable: object;
    sourceSmartTable = new LocalDataSource();
    selectedEmployee: EmployeeViewModel;

    private _ngDestroy$ = new Subject<void>();

    constructor(
        private organizationsService: OrganizationsService,
        private employeesService: EmployeesService,
        private dialogService: NbDialogService,
        private store: Store,
        private router: Router
    ) { }

    ngOnInit() {
        const selectedId = this.store.selectedOrganizationId;

        if (selectedId) {
            this.loadPage(selectedId);
        }

        this.store.selectedOrganizationId$
            .pipe(takeUntil(this._ngDestroy$))
            .subscribe((id) => this.loadPage(id));

        this._loadSmartTableSettings();
    }

    selectEmployeeTmp(ev: {
        data: EmployeeViewModel,
        isSelected: boolean,
        selected: EmployeeViewModel[],
        source: LocalDataSource
    }) {
        if (ev.isSelected) {
            this.selectedEmployee = ev.data;
        } else {
            this.selectedEmployee = null;
        }
    }

    async add() {
        const dialog = this.dialogService.open(EmployeeMutationComponent)

        const data = await dialog.onClose.pipe(first()).toPromise();

        if (data) {
            this.loadPage();
        }
    }

    edit() {
        this.router.navigate(['/pages/employees/edit/' + this.selectedEmployee.id]);
    }

    async delete() {

        this.dialogService.open(DeleteConfirmationComponent, {
            context: { recordType: 'Employee' }
        })
            .onClose
            .pipe(takeUntil(this._ngDestroy$))
            .subscribe(async result => {
                if (result) {
                    await this.employeesService.setEmployeeAsInactive(this.selectedEmployee.id);
                    this.loadPage();
                }
            });


    }

    async endWork() {
        const dialog = this.dialogService.open(EmployeeEndWorkComponent, { context: this.selectedEmployee.endWork });

        const data = await dialog.onClose.pipe(first()).toPromise();
        if (data) {
            await this.employeesService.setEmployeeEndWork(this.selectedEmployee.id, data);
            this.loadPage();
        }
    }

    private async loadPage(id: string = this.store.selectedOrganizationId) {
        const { name } = await this.organizationsService
            .getById(id)
            .pipe(first())
            .toPromise()

        const { items } = await this.employeesService.getAll(['user'], { organization: { id } }).pipe(first()).toPromise();

        const employeesVm: EmployeeViewModel[] = items.filter(i => i.isActive).map((i) => {
            return {
                fullName: `${i.user.firstName} ${i.user.lastName}`,
                email: i.user.email,
                id: i.id,
                isActive: i.isActive,
                endWork: i.endWork ? new Date(i.endWork).toUTCString() : 'Indefinite',
                imageUrl: i.user.imageUrl,
                // TODO laod real bonus and bonusDate
                bonus: Math.floor(1000 * Math.random()) + 10,
                bonusDate: Date.now()
            };
        });

        this.sourceSmartTable.load(employeesVm);

        this.organizationName = name;
    }

    private _loadSmartTableSettings() {
        this.settingsSmartTable = {
            actions: false,
            columns: {
                fullName: {
                    title: 'Full Name',
                    type: 'custom',
                    renderComponent: EmployeeFullNameComponent,
                    class: 'align-row'
                },
                email: {
                    title: 'Email',
                    type: 'email',
                },
                bonus: {
                    title: 'Bonus',
                    type: 'custom',
                    width: '15%',
                    filter: false,
                    class: 'text-center',
                    renderComponent: EmployeeBonusComponent
                },
                endWork: {
                    title: 'End Work',
                    type: 'string'
                }
            },
            pager: {
                display: true,
                perPage: 8
            }
        }
    }

    ngOnDestroy() {
        this._ngDestroy$.next();
        this._ngDestroy$.complete();
    }
}