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

import * as moment from 'moment';
import * as timezone from 'moment-timezone';

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
	listOfZones = timezone.tz.names().filter((zone) => zone.includes('/'));
	// todo: maybe its better to place listOfDateFormats somewhere more global for the app?
	listOfDateFormats = [
		'M/D/YYYY',
		'D/M/YYYY',
		'DDDD/MMMM/YYYY',
		'MMMM Do YYYY',
		'dddd, MMMM Do YYYY',
		'MMM D YYYY',
		'YYYY-MM-DD',
		'ddd, MMM D YYYY'
	];

	constructor(private fb: FormBuilder) {}

	get mainUpdateObj() {
		return this.form.getRawValue();
	}

	getHex() {
		return this.form.value.brandColor;
	}

	getTimeWithOffset(zone: string) {
		let cutZone = zone;
		if (zone.includes('/')) {
			cutZone = zone.split('/')[1];
		}

		const offset = timezone.tz(zone).format('zZ');

		return '(' + offset + ') ' + cutZone;
	}

	dateFormatPreview(format: string) {
		return moment().format(format);
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
			],
			dateFormat: [this.organization.dateFormat],
			timeZone: [this.organization.timeZone]
		});
	}
}
