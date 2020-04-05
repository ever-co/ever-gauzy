import { formatDate } from '@angular/common';
import {
	Component,
	EventEmitter,
	OnDestroy,
	OnInit,
	Output
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
	BonusTypeEnum,
	Country,
	CurrenciesEnum,
	DefaultValueDateTypeEnum,
	DEFAULT_PROFIT_BASED_BONUS,
	RegionsEnum,
	WeekDaysEnum
} from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import * as moment from 'moment';
import * as timezone from 'moment-timezone';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CountryService } from '../../../@core/services/country.service';
@Component({
	selector: 'ga-organizations-step-form',
	templateUrl: './organizations-step-form.component.html',
	styleUrls: [
		'./organizations-step-form.component.scss',
		'../../../@shared/user/edit-profile-form/edit-profile-form.component.scss'
	]
})
export class OrganizationsStepFormComponent implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();

	hoverState: boolean;
	currencies: string[] = Object.values(CurrenciesEnum);
	countries: Country[];
	defaultValueDateTypes: string[] = Object.values(DefaultValueDateTypeEnum);
	defaultBonusTypes: string[] = Object.values(BonusTypeEnum);
	listOfZones = timezone.tz.names().filter((zone) => zone.includes('/'));
	weekdays: string[] = Object.values(WeekDaysEnum);
	regionCodes = Object.keys(RegionsEnum);
	regionCode: string;
	numberFormats = ['USD', 'BGN', 'ILS'];
	listOfDateFormats = ['L', 'L hh:mm', 'LL', 'LLL', 'LLLL'];

	orgMainForm: FormGroup;
	orgLocationForm: FormGroup;
	orgBonusForm: FormGroup;
	orgSettingsForm: FormGroup;

	@Output()
	createOrganization = new EventEmitter();

	constructor(
		private fb: FormBuilder,
		private toastrService: NbToastrService,
		private countryService: CountryService
	) {}

	async ngOnInit() {
		this._initializedForm();
		await this.loadCountries();
	}

	private _initializedForm() {
		this.orgMainForm = this.fb.group({
			imageUrl: [
				'https://dummyimage.com/330x300/8b72ff/ffffff.jpg&text',
				Validators.required
			],
			currency: [, Validators.required],
			name: [, Validators.required],
			officialName: [],
			taxId: []
		});

		this.orgLocationForm = this.fb.group({
			country: [],
			city: [],
			postcode: [],
			address: [],
			address2: []
		});

		this.orgBonusForm = this.fb.group({
			bonusType: [BonusTypeEnum.PROFIT_BASED_BONUS],
			bonusPercentage: [
				DEFAULT_PROFIT_BASED_BONUS,
				[Validators.min(0), Validators.max(100)]
			],
			fiscalStartDate: [
				formatDate(
					new Date(`01/01/${new Date().getFullYear()}`),
					'yyyy-MM-dd',
					'en'
				)
			],
			fiscalEndDate: [
				formatDate(
					new Date(`12/31/${new Date().getFullYear()}`),
					'yyyy-MM-dd',
					'en'
				)
			],
			invitesAllowed: [true],
			inviteExpiryPeriod: [7, [Validators.min(1)]]
		});
		this.orgSettingsForm = this.fb.group({
			timeZone: [],
			startWeekOn: [],
			defaultValueDateType: [
				DefaultValueDateTypeEnum.TODAY,
				Validators.required
			],
			regionCode: [],
			numberFormat: [],
			dateFormat: []
		});
	}

	private async loadCountries() {
		const { items } = await this.countryService.getAll();
		this.countries = items;
	}

	handleImageUploadError(error) {
		this.toastrService.danger(error, 'Error');
	}

	loadDefaultBonusPercentage(bonusType: BonusTypeEnum) {
		const bonusPercentageControl = this.orgBonusForm.get('bonusPercentage');

		switch (bonusType) {
			case BonusTypeEnum.PROFIT_BASED_BONUS:
				bonusPercentageControl.setValue(75);
				bonusPercentageControl.enable();
				break;
			case BonusTypeEnum.REVENUE_BASED_BONUS:
				bonusPercentageControl.setValue(10);
				bonusPercentageControl.enable();
				break;
			default:
				bonusPercentageControl.setValue(null);
				bonusPercentageControl.disable();
				break;
		}
	}
	toggleExpiry(checked) {
		const inviteExpiryControl = this.orgBonusForm.get('inviteExpiryPeriod');
		checked ? inviteExpiryControl.enable() : inviteExpiryControl.disable();
	}

	numberFormatPreview(format: string) {
		const number = 12345.67;
		let code: string;
		switch (format) {
			case 'BGN':
				code = 'bg';
				break;
			case 'USD':
				code = 'en';
				break;
			case 'ILS':
				code = 'he';
				break;
		}
		return number.toLocaleString(`${code}`, {
			style: 'currency',
			currency: `${format}`,
			currencyDisplay: 'symbol'
		});
	}

	dateFormatPreview(format: string) {
		this.orgSettingsForm.valueChanges
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((val) => {
				this.regionCode = val.regionCode;
			});

		moment.locale(this.regionCode);
		return moment().format(format);
	}

	getTimeWithOffset(zone: string) {
		let cutZone = zone;
		if (zone.includes('/')) {
			cutZone = zone.split('/')[1];
		}

		const offset = timezone.tz(zone).format('zZ');

		return '(' + offset + ') ' + cutZone;
	}

	addOrganization() {
		const consolidatedFormValues = {
			...this.orgMainForm.value,
			...this.orgLocationForm.value,
			...this.orgBonusForm.value,
			...this.orgSettingsForm.value
		};
		this.createOrganization.emit(consolidatedFormValues);
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
