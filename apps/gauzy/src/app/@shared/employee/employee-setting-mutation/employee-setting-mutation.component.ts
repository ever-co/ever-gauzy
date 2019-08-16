import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import { EmployeeSettings, CurrenciesEnum, OrganizationSelectInput } from '@gauzy/models';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { Store } from '../../../@core/services/store.service';
import { first } from 'rxjs/operators';

@Component({
    selector: 'ngx-employee-setting-mutation',
    templateUrl: './employee-setting-mutation.component.html',
    styleUrls: ['./employee-setting-mutation.component.scss']
})
export class EmployeeSettingMutationComponent implements OnInit {
    protected form: FormGroup;
    settingTypes = ['Salary', 'Salary Taxes', 'Extra Bonus'];
    employeeSetting?: EmployeeSettings;
    currencies = Object.values(CurrenciesEnum);

    constructor(private fb: FormBuilder,
        protected dialogRef: NbDialogRef<EmployeeSettingMutationComponent>,
        private organizationsService: OrganizationsService,
        private store: Store
    ) { }

    get currency() {
        return this.form.get('currency');
    }

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
            value: [employeeSetting ? employeeSetting.value : '', Validators.required],
            currency: [employeeSetting ? employeeSetting.currency : '', Validators.required]
        });

        this._loadDefaultCurrency();
    }

    private async _loadDefaultCurrency() {
        const orgData = await this.organizationsService
            .getById(
                this.store.selectedOrganization.id,
                [OrganizationSelectInput.currency]
            ).pipe(first()).toPromise();

        if (orgData && this.currency && !this.currency.value) {
            this.currency.setValue(orgData.currency);
        }
    }
}
