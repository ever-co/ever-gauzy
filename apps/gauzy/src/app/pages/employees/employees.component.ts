import { Component, OnInit, OnDestroy } from '@angular/core';
import { Store } from '../../@core/services/store.service';
import { OrganizationsService } from '../../@core/services/organizations.service';
import { first, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { LocalDataSource } from 'ng2-smart-table';
import { EmployeesService } from '../../@core/services/employees.service';
import { NbDialogService } from '@nebular/theme';
import { BasicInfoFormComponent } from '../../@shared/user/forms/basic-info/basic-info-form.component';

interface EmployeeViewModel {
    fullName: string;
    email: string;
    bonus?: number;
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

        this._loadSettingsSmartTable();
    }

    selectEmployeeTmp(ev) {
        if (ev.isSelected) {
            this.selectedEmployee = ev.data;
        } else {
            this.selectedEmployee = null;
        }
    }

    add() {
        this.dialogService.open(BasicInfoFormComponent)
    }

    edit() {
        console.warn('TODO go to edit employee page');
    }

    private async loadPage(id: string) {
        const { name } = await this.organizationsService
            .getById(id)
            .pipe(first())
            .toPromise()

        const { items } = await this.employeesService.getAll(['user'], { organization: { id } });

        const employeesVm: EmployeeViewModel[] = items.map((i) => {
            return {
                fullName: `${i.user.firstName} ${i.user.lastName}`,
                email: i.user.email,
                // TODO laod real bonus
                bonus: 0,
            };
        });

        this.sourceSmartTable.load(employeesVm);

        this.organizationName = name;
    }

    private _loadSettingsSmartTable() {
        this.settingsSmartTable = {
            actions: false,
            columns: {
                fullName: {
                    title: 'Full Name',
                    type: 'string',
                },
                email: {
                    title: 'Email',
                    type: 'email',
                },
                bonus: {
                    title: 'Bonus',
                    type: 'number',
                    width: '15%'
                },
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