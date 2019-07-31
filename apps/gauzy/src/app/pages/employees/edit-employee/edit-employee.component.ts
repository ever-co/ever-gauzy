import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, first } from 'rxjs/operators';
import { EmployeesService } from '../../../@core/services/employees.service';
import { Store } from '../../../@core/services/store.service';
import { Employee } from '@gauzy/models';
import { SelectedEmployee } from '../../../@theme/components/header/selectors/employee/employee.component';
import { NbDialogService } from '@nebular/theme';
import { EmployeeSettingMutationComponent } from '../../../@shared/employee/employee-setting-mutation/employee-setting-mutation.component';

@Component({
    selector: 'ngx-edit-employee',
    templateUrl: './edit-employee.component.html',
    styleUrls: ['./edit-employee.component.scss', '../../dashboard/dashboard.component.scss']
})
export class EditEmployeeComponent implements OnInit, OnDestroy {
    private _ngDestroy$ = new Subject<void>();
    selectedEmployee: Employee;
    selectedDate: Date;
    selectedEmployeeFromHeader: SelectedEmployee;

    constructor(private route: ActivatedRoute,
        private router: Router,
        private employeeService: EmployeesService,
        private store: Store,
        private dialogService: NbDialogService) { }

    async ngOnInit() {
        this.store.selectedDate$
            .pipe(takeUntil(this._ngDestroy$))
            .subscribe(date => {
                this.selectedDate = date;
            });

        this.route.params
            .pipe(takeUntil(this._ngDestroy$))
            .subscribe(async params => {
                const id = params.id;

                // TODO: Load all employee_settings from DB!

                const { items } = await this.employeeService.getAll(['user'], { id }).pipe(first()).toPromise();

                this.selectedEmployee = items[0];

                this.store.selectedEmployee = {
                    id: items[0].id,
                    firstName: items[0].user.firstName,
                    lastName: items[0].user.lastName,
                    imageUrl: items[0].user.imageUrl
                };

                this.store.selectedEmployee$
                .pipe(takeUntil(this._ngDestroy$))
                .subscribe(employee => {
                    this.selectedEmployeeFromHeader = employee;
                    if (employee.id) {
                        this.router.navigate(['/pages/employees/edit/' + employee.id])
                    }
                });
            });
    }

    editEmployee() {
        this.router.navigate(['/pages/employees/edit/' + this.selectedEmployee.id + '/profile']);
    }

    addEmployeeSetting() {
        this.dialogService.open(EmployeeSettingMutationComponent);
    }

    ngOnDestroy() {
        this._ngDestroy$.next();
        this._ngDestroy$.complete();
    }
}
