import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Location } from '@angular/common';
import { EmployeesService } from 'apps/gauzy/src/app/@core/services/employees.service';
import { first, takeUntil } from 'rxjs/operators';
import { Employee } from '@gauzy/models';
import { Subject, Subscription } from 'rxjs';
import { UsersService } from 'apps/gauzy/src/app/@core/services/users.service';

@Component({
    selector: 'ngx-edit-employee-profile',
    templateUrl: './edit-employee-profile.component.html',
    styleUrls: ['./edit-employee-profile.component.scss']
})
export class EditEmployeeProfileComponent implements OnInit, OnDestroy {
    form: FormGroup;
    private _ngDestroy$ = new Subject<void>();
    paramSubscription: Subscription;
    hoverState: boolean;
    fakeDepartments = [
        {
            departmentName: 'Accounting',
            departmentId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            departmentName: 'IT',
            departmentId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            departmentName: 'Marketing',
            departmentId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            departmentName: 'Human Resources',
            departmentId: (Math.floor(Math.random() * 101) + 1).toString()
        }
    ];
    fakePositions = [
        {
            positionName: 'Developer',
            positionId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            positionName: 'Project Manager',
            positionId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            positionName: 'Accounting Employee',
            positionId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            positionName: 'Head of Human Resources',
            positionId: (Math.floor(Math.random() * 101) + 1).toString()
        },
    ];
    routeParams: Params;
    selectedEmployee: Employee;

    constructor(private route: ActivatedRoute,
        private fb: FormBuilder,
        private location: Location,
        private employeeService: EmployeesService,
        private userService: UsersService) { }

    ngOnInit() {
        this.route.params
            .pipe(takeUntil(this._ngDestroy$))
            .subscribe(params => {
                this.routeParams = params;
                this._loadEmployeeData();
            });
    }

    goBack() {
        this.location.back();
    }

    handleImageUploadError(error: any) {
        console.error(error);
    }

    async submitForm() {
        if (this.form.valid) {
            try {
                this.userService.update(this.selectedEmployee.user.id, this.form.value);
                this._loadEmployeeData();
            } catch (error) {
                console.error(error)
            }
        }
    }

    private async _loadEmployeeData() {
        const { id } = this.routeParams;
        const { items } = await this.employeeService
            .getAll(['user'], { id })
            .pipe(first()).toPromise();

        this.selectedEmployee = items[0];
        this._initializeForm(items[0]);
    }

    private _initializeForm(employee: Employee) {
        // TODO: Implement Departments and Positions!
        this.form = this.fb.group({
            username: [employee.user.username, Validators.required],
            email: [employee.user.email, Validators.required],
            firstName: [employee.user.firstName, Validators.required],
            lastName: [employee.user.lastName, Validators.required],
            imageUrl: [employee.user.imageUrl, Validators.required]
        });
    }

    ngOnDestroy() {
        this._ngDestroy$.next();
        this._ngDestroy$.complete();
    }
}
