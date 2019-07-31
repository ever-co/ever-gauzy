import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, first } from 'rxjs/operators';
import { EmployeesService } from '../../../@core/services/employees.service';
import { Store } from '../../../@core/services/store.service';
import { Employee, EmployeeSettings } from '@gauzy/models';
import { SelectedEmployee } from '../../../@theme/components/header/selectors/employee/employee.component';
import { NbDialogService } from '@nebular/theme';
import { EmployeeSettingMutationComponent } from '../../../@shared/employee/employee-setting-mutation/employee-setting-mutation.component';
import { EmployeeSettingsService } from '../../../@core/services/employee-settings.service';

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
    selectedEmployeeSettings: EmployeeSettings[];

    constructor(private route: ActivatedRoute,
                private router: Router,
                private employeeService: EmployeesService,
                private store: Store,
                private dialogService: NbDialogService,
                private employeeSettingService: EmployeeSettingsService) { }

    async ngOnInit() {
        this.store.selectedDate$
            .pipe(takeUntil(this._ngDestroy$))
            .subscribe(date => {
                this.selectedDate = date;

                if (this.selectedEmployeeFromHeader) {
                    this._loadEmployeeSettings();
                }
            });

        this.route.params
            .pipe(takeUntil(this._ngDestroy$))
            .subscribe(async params => {
                const id = params.id;

                const { items } = await this.employeeService.getAll(['user'], { id }).pipe(first()).toPromise();

                this.selectedEmployee = items[0];

                this.store.selectedEmployee = {
                    id: items[0].id,
                    firstName: items[0].user.firstName,
                    lastName: items[0].user.lastName,
                    imageUrl: items[0].user.imageUrl
                };

                if (this.selectedDate) {
                    this._loadEmployeeSettings();
                }

                this.store.selectedEmployee$
                    .pipe(takeUntil(this._ngDestroy$))
                    .subscribe(employee => {
                        this.selectedEmployeeFromHeader = employee;
                        if (employee.id) {
                            this.router.navigate(['/pages/employees/edit/' + employee.id]);
                        }
                    });
            });
    }

    editEmployee() {
        this.router.navigate(['/pages/employees/edit/' + this.selectedEmployee.id + '/profile']);
    }

    addEmployeeSetting() {
        this.dialogService.open(EmployeeSettingMutationComponent)
            .onClose
            .pipe(takeUntil(this._ngDestroy$))
            .subscribe(async result => {
                if (result) {
                    await this.employeeSettingService.create({
                        employeeId: this.selectedEmployee.id,
                        settingType: result.settingType,
                        value: result.value,
                        year: this.selectedDate.getFullYear(),
                        month: this.selectedDate.getMonth() + 1
                    });

                    this._loadEmployeeSettings();
                }
            });
    }

    getMonthString(month: number) {
        const months = [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December"
        ];

        return months[month - 1];
    }

    private async _loadEmployeeSettings() {
        this.selectedEmployeeSettings = (await this.employeeSettingService.getAll([], {
            employeeId: this.selectedEmployee.id,
            year: this.selectedDate.getFullYear(),
            month: this.selectedDate.getMonth() + 1
        })).items;
    }

    ngOnDestroy() {
        this._ngDestroy$.next();
        this._ngDestroy$.complete();
    }
}
