import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import { EmployeeSettings } from '@gauzy/models';

@Component({
    selector: 'ngx-employee-setting-mutation',
    templateUrl: './employee-setting-mutation.component.html',
    styleUrls: ['./employee-setting-mutation.component.scss']
})
export class EmployeeSettingMutationComponent implements OnInit {
    protected form: FormGroup;
    settingTypes = ['Salary', 'Salary Taxes', 'Extra Bonus'];
    employeeSetting?: EmployeeSettings;

    constructor(private fb: FormBuilder,
        protected dialogRef: NbDialogRef<EmployeeSettingMutationComponent>) { }

    ngOnInit() {
        this.employeeSetting ? this._initializeForm(this.employeeSetting) : this._initializeForm();
    }

    submitForm() {
        if (this.form.valid) {
            this.dialogRef.close(this.form.value);
        }
    }

    private _initializeForm(employeeSetting?: EmployeeSettings) {
        this.form = this.fb.group({
            settingType: [employeeSetting ? employeeSetting.settingType : '', Validators.required],
            value: [employeeSetting ? employeeSetting.value : '', Validators.required]
        });
    }
}
