import { Component, Input, OnInit } from '@angular/core';
import {
	FormBuilder,
	FormGroup,
	Validators,
	ValidatorFn,
	AbstractControl
} from '@angular/forms';
import {
	Organization,
	CurrenciesEnum,
	DefaultValueDateTypeEnum,
	AlignmentOptions
} from '@gauzy/models';

@Component({
	selector: 'ga-edit-org-main',
	templateUrl: './edit-organization-main.component.html',
	styleUrls: ['./edit-organization-main.component.scss']
})
export class EditOrganizationMainComponent implements OnInit {
	@Input()
	organization: Organization;

	form: FormGroup;

	currencies: string[] = Object.values(CurrenciesEnum);
	defaultValueDateTypes: string[] = Object.values(DefaultValueDateTypeEnum);
	defaultAlignmentTypes: string[] = Object.values(AlignmentOptions).map(
		(type) => {
			return type[0] + type.substr(1, type.length).toLowerCase();
		}
	);

	constructor(private fb: FormBuilder) {}

	get mainUpdateObj() {
		return this.form.getRawValue();
	}

	getHex() {
		return this.form.value.brandColor;
	}

	forbiddenColorValidator(nameRe: RegExp): ValidatorFn {
		return (control: AbstractControl): { [key: string]: any } | null => {
			const forbidden = !nameRe.test(control.value);
			return forbidden ? { badColor: { value: control.value } } : null;
		};
	}

	ngOnInit(): void {
		this._initializedForm();
	}

	private _initializedForm() {
		const HEX_REGEX = /^[-+]?[0-9A-Fa-f]+\.?[0-9A-Fa-f]*?$/;
		this.form = this.fb.group({
			currency: [this.organization.currency, Validators.required],
			name: [this.organization.name, Validators.required],
			defaultValueDateType: [
				this.organization.defaultValueDateType,
				Validators.required
			],
			defaultAlignmentType: [this.organization.defaultAlignmentType],
			brandColor: [
				this.organization.brandColor,
				this.forbiddenColorValidator(HEX_REGEX)
			]
		});
	}
}
