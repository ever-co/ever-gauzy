import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
	AlignmentOptions,
	Country,
	CurrenciesEnum,
	DefaultValueDateTypeEnum,
	Organization,
	WeekDaysEnum
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

	@Input()
	countries: Country[];

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
	weekdays: string[] = Object.values(WeekDaysEnum);
	constructor(private fb: FormBuilder) {}

	get mainUpdateObj() {
		return this.form.getRawValue();
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

	ngOnInit(): void {
		this._initializedForm();
	}

	private _initializedForm() {
		this.form = this.fb.group({
			currency: [this.organization.currency, Validators.required],
			name: [this.organization.name, Validators.required],
			defaultValueDateType: [
				this.organization.defaultValueDateType,
				Validators.required
			],
			defaultAlignmentType: [this.organization.defaultAlignmentType],
			brandColor: [this.organization.brandColor],
			dateFormat: [this.organization.dateFormat],
			timeZone: [this.organization.timeZone],
			officialName: [this.organization.officialName],
			startWeekOn: [this.organization.startWeekOn],
			taxId: [this.organization.taxId],
			country: [this.organization.country],
			city: [this.organization.city],
			address: [this.organization.address],
			address2: [this.organization.address2]
		});
	}
}
