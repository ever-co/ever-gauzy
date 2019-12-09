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
import { EmployeesService } from '../../../../../@core/services';
import { OrganizationsService } from '../../../../../@core/services/organizations.service';
import * as moment from 'moment';
import * as timezone from 'moment-timezone';
import { first } from 'rxjs/operators';
import { NbToastrService } from '@nebular/theme';

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

	imageUrl: string;
	hoverState: boolean;
	employeesCount: number;

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
	constructor(
		private fb: FormBuilder,
		private employeesService: EmployeesService,
		private organizationService: OrganizationsService,
		private toastrService: NbToastrService
	) {}

	updateImageUrl(url: string) {
		this.imageUrl = url;
	}

	handleImageUploadError(event: any) {}

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
		this.imageUrl = this.organization.imageUrl;
		this.loadEmployeesCount();
	}

	private async loadEmployeesCount() {
		const { total } = await this.employeesService
			.getAll([], { organization: { id: this.organization.id } })
			.pipe(first())
			.toPromise();

		this.employeesCount = total;
	}

	async updateOrganizationSettings() {
		this.organizationService.update(this.organization.id, {
			imageUrl: this.imageUrl,
			...this.form.getRawValue()
		});
		this.toastrService.primary(
			this.organization.name + ' organization main info updeted.',
			'Success'
		);
		this.goBack();
	}

	goBack() {
		const currentURL = window.location.href;
		window.location.href = currentURL.substring(
			0,
			currentURL.indexOf('/settings')
		);
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
