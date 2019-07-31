import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import { Store } from '../../../@core/services/store.service';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

@Component({
    selector: 'ngx-employee-setting-mutation',
    templateUrl: './employee-setting-mutation.component.html',
    styleUrls: ['./employee-setting-mutation.component.scss']
})
export class EmployeeSettingMutationComponent implements OnInit, OnDestroy {
    protected form: FormGroup;
    private _ngDestroy$ = new Subject();
    selectedDate: Date;
    settingTypes = ['Salary', 'Salary Taxes'];

    constructor(private fb: FormBuilder,
                private store: Store,
                protected dialogRef: NbDialogRef<EmployeeSettingMutationComponent>) { }

    ngOnInit() {
        this.store.selectedDate$
            .pipe(takeUntil(this._ngDestroy$))
            .subscribe(date => {
                this.selectedDate = date;
            });

        this._initializeForm();
    }

    submitForm() {
        this.dialogRef.close(this.form.value);
    }

    private _initializeForm() {
        this.form = this.fb.group({
            settingType: ['', Validators.required],
            value: ['', Validators.required],
            valueDate: this.selectedDate
        });
    }

    ngOnDestroy() {
        this._ngDestroy$.next();
        this._ngDestroy$.complete();
    }
}
