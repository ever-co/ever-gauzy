import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
	AlignmentOptions,
	DefaultValueDateTypeEnum,
	Organization,
	WeekDaysEnum,
	RegionsEnum
} from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { OrganizationEditStore } from 'apps/gauzy/src/app/@core/services/organization-edit-store.service';
import * as moment from 'moment';
import * as timezone from 'moment-timezone';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { OrganizationsService } from '../../../../../@core/services/organizations.service';

@Component({
	selector: 'ga-edit-org-other-settings',
	templateUrl: './edit-organization-other-settings.component.html',
	styleUrls: ['./edit-organization-other-settings.component.scss']
})
export class EditOrganizationOtherSettingsComponent implements OnInit {
	private _ngDestroy$ = new Subject<void>();

	organization: Organization;

	form: FormGroup;

	defaultValueDateTypes: string[] = Object.values(DefaultValueDateTypeEnum);
	defaultAlignmentTypes: string[] = Object.values(AlignmentOptions).map(
		(type) => {
			return type[0] + type.substr(1, type.length).toLowerCase();
		}
	);
	listOfZones = timezone.tz.names().filter((zone) => zone.includes('/'));
	// todo: maybe its better to place listOfDateFormats somewhere more global for the app?
	listOfDateFormats = ['L', 'LL', 'LLL', 'LLLL'];
	numberFormats: ['12000.00', '12 000.00', '12 000,00', "12'000.00"];
	numberFormat: string;
	weekdays: string[] = Object.values(WeekDaysEnum);
	regionCodes = Object.keys(RegionsEnum);
	regionCode: string;
	regions = Object.values(RegionsEnum);

	constructor(
		private fb: FormBuilder,
		private organizationService: OrganizationsService,
		private toastrService: NbToastrService,
		private readonly organizationEditStore: OrganizationEditStore
	) {}

	getTimeWithOffset(zone: string) {
		let cutZone = zone;
		if (zone.includes('/')) {
			cutZone = zone.split('/')[1];
		}

		const offset = timezone.tz(zone).format('zZ');

		return '(' + offset + ') ' + cutZone;
	}

	dateFormatPreview(format: string) {
		moment.locale(this.regionCode);
		return moment().format(format);
	}

	ngOnInit(): void {
		this.organizationEditStore.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((organization) => {
				this.organization = organization;
				this._initializedForm();
			});
	}

	async updateOrganizationSettings() {
		this.organizationService.update(
			this.organization.id,
			this.form.getRawValue()
		);
		this.toastrService.primary(
			this.organization.name + ' organization settings updated.',
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
		if (!this.organization) {
			return;
		}

		this.form = this.fb.group({
			defaultValueDateType: [
				this.organization.defaultValueDateType,
				Validators.required
			],
			defaultAlignmentType: [this.organization.defaultAlignmentType],
			brandColor: [this.organization.brandColor],
			dateFormat: [this.organization.dateFormat],
			timeZone: [this.organization.timeZone],
			startWeekOn: [this.organization.startWeekOn]
		});
	}
}
