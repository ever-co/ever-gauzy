import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Organization, CurrenciesEnum, DefaultValueDateTypeEnum } from '@gauzy/models';

@Component({
    selector: 'ga-edit-org-main',
    templateUrl: "./edit-organization-main.component.html"
})
export class EditOrganizationMainComponent implements OnInit {
    @Input()
    organization: Organization;

    form: FormGroup;

    currencies: string[] = Object.values(CurrenciesEnum);
    defaultValueDateTypes: string[] = Object.values(DefaultValueDateTypeEnum);

    constructor(private fb: FormBuilder) {
    }

    get mainUpdateObj() {
        return this.form.getRawValue();
    }

    ngOnInit(): void {
        this._initializedForm();
    }

    private _initializedForm() {
        this.form = this.fb.group({
            currency: [this.organization.currency, Validators.required],
            name: [this.organization.name, Validators.required],
            defaultValueDateType: [this.organization.defaultValueDateType, Validators.required]
        });
    }
}