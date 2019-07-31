import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
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
    protected form: FormGroup;
    private _ngDestroy$ = new Subject<void>();
    paramSubscription: Subscription;
    profilePhoto: string;
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

    constructor(private route: ActivatedRoute,
        private fb: FormBuilder,
        private location: Location,
        private employeeService: EmployeesService,
        private userService: UsersService) { }

    ngOnInit() {
        this.route.params
            .pipe(takeUntil(this._ngDestroy$))
            .subscribe(async params => {
                const { id } = params;
                const { items } = await this.employeeService
                    .getAll(['user'], { id })
                    .pipe(first()).toPromise();
                this._initializeForm(items[0]);
            });
    }

    goBack() {
        this.location.back();
    }

    handlePhotoUpload(ev: Event) {
        const file = (<HTMLInputElement>ev.target).files[0];
        console.log('Not implemented yet! \r\n', file);
    }

    sumbitForm() {
        if (this.form.valid) {
            this.userService.update() // TODO: Implement me!
        }
    }

    private _initializeForm(employee: Employee) {
        this.form = this.fb.group({
            username: [employee.user.username, Validators.required],
            email: [employee.user.email, Validators.required],
            firstName: [employee.user.firstName, Validators.required],
            lastName: [employee.user.lastName, Validators.required]
        });

        this.profilePhoto = employee.user.imageUrl;
    }

    ngOnDestroy() {
        this._ngDestroy$.next();
        this._ngDestroy$.complete();
    }
}
