import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';

@Component({
    selector: 'ngx-employee-setting-mutation',
    templateUrl: './employee-setting-mutation.component.html',
    styleUrls: ['./employee-setting-mutation.component.scss']
})
export class EmployeeSettingMutationComponent implements OnInit {
    protected form: FormGroup;
    settingTypes = ['Salary', 'Salary Taxes', 'Extra Bonus'];

    constructor(private fb: FormBuilder,
                protected dialogRef: NbDialogRef<EmployeeSettingMutationComponent>) { }

    ngOnInit() {
        this._initializeForm();
    }

    submitForm() {
        this.dialogRef.close(this.form.value);
    }

    private _initializeForm() {
        this.form = this.fb.group({
            settingType: ['', Validators.required],
            value: ['', Validators.required]
        });
    }
}
