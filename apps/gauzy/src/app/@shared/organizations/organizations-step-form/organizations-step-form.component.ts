import * as moment from 'moment';
import * as timezone from 'moment-timezone';
import { formatDate } from '@angular/common';
import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	EventEmitter,
	Input,
	OnDestroy,
	OnInit,
	Output,
	ViewChild
} from '@angular/core';
import {
	FormBuilder,
	FormControl,
	FormGroup,
	Validators
} from '@angular/forms';
import {
	BonusTypeEnum,
	ICountry,
	DefaultValueDateTypeEnum,
	RegionsEnum,
	WeekDaysEnum,
	ITag,
	ICurrency,
	IUser,
	CurrenciesEnum
} from '@gauzy/models';
import { LocationFormComponent } from '../../forms/location';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { LatLng } from 'leaflet';
import { LeafletMapComponent } from '../../forms/maps/leaflet/leaflet.component';
import { Store } from '../../../@core/services/store.service';
import { filter, tap } from 'rxjs/operators';
import { retrieveNameFromEmail } from '@gauzy/utils';
import { environment as ENV } from 'apps/gauzy/src/environments/environment';
import { ToastrService } from '../../../@core/services/toastr.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-organizations-step-form',
	templateUrl: './organizations-step-form.component.html',
	styleUrls: [
		'./organizations-step-form.component.scss',
		'../../../@shared/user/edit-profile-form/edit-profile-form.component.scss'
	]
})
export class OrganizationsStepFormComponent
	implements OnInit, OnDestroy, AfterViewInit {
	@ViewChild('locationFormDirective')
	locationFormDirective: LocationFormComponent;

	@ViewChild('leafletTemplate')
	leafletTemplate: LeafletMapComponent;

	readonly locationForm: FormGroup = LocationFormComponent.buildForm(this.fb);

	locationFormBlank: boolean;
	hoverState: boolean;
	countries: ICountry[];
	defaultValueDateTypes: string[] = Object.values(DefaultValueDateTypeEnum);
	defaultBonusTypes: string[] = Object.values(BonusTypeEnum);
	listOfZones = timezone.tz.names().filter((zone) => zone.includes('/'));
	weekdays: string[] = Object.values(WeekDaysEnum);
	regionCodes = Object.keys(RegionsEnum);
	regionCode: string;
	numberFormats = ['USD', 'BGN', 'ILS'];
	listOfDateFormats = ['L', 'L hh:mm', 'LL', 'LLL', 'LLLL'];

	orgMainForm: FormGroup;
	orgBonusForm: FormGroup;
	orgSettingsForm: FormGroup;
	tags: ITag[] = [];
	country: ICountry;
	user: IUser;

	@Input('onboarding') onboarding?: boolean;

	@Output()
	createOrganization = new EventEmitter();

	constructor(
		private fb: FormBuilder,
		private toastrService: ToastrService,
		private readonly cdr: ChangeDetectorRef,
		private readonly store: Store
	) {}

	ngOnInit() {
		this.store.user$
			.pipe(
				filter((user) => !!user),
				tap((user: IUser) => (this.user = user))
			)
			.subscribe();
		this._initializedForm();
	}

	ngAfterViewInit() {
		this.cdr.detectChanges();
	}

	private _initializedForm() {
		this.orgMainForm = this.fb.group({
			imageUrl: [
				'https://dummyimage.com/330x300/8b72ff/ffffff.jpg&text',
				Validators.required
			],
			currency: [ENV.DEFAULT_CURRENCY || CurrenciesEnum.USD],
			name: [retrieveNameFromEmail(this.user.email), Validators.required],
			officialName: [],
			taxId: [],
			tags: []
		});
		this.orgBonusForm = this.fb.group({
			bonusType: [],
			bonusPercentage: [{ value: null, disabled: true }]
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
			dateFormat: [],
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

		const bonusType = <FormControl>this.orgBonusForm.get('bonusType');
		const bonusPercentage = <FormControl>(
			this.orgBonusForm.get('bonusPercentage')
		);
		bonusType.valueChanges.subscribe((value) => {
			if (value) {
				bonusPercentage.setValidators([
					Validators.required,
					Validators.min(0),
					Validators.max(100)
				]);
			} else {
				bonusPercentage.setValidators(null);
			}
			bonusPercentage.updateValueAndValidity();
		});

		this.locationForm.valueChanges.subscribe((value) => {
			if (value.hasOwnProperty('loc')) {
				delete value['loc'];
			}
			const values = Object.values(value).filter((item) => item);
			this.locationFormBlank = values.length === 0 ? true : false;
		});
		this.cdr.detectChanges();
	}

	handleImageUploadError(error) {
		this.toastrService.danger(error);
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
		bonusPercentageControl.updateValueAndValidity();
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
			.pipe(untilDestroyed(this))
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
		const location = this.locationFormDirective.getValue();
		const { coordinates } = location['loc'];
		delete location['loc'];

		const [latitude, longitude] = coordinates;
		const contact = {
			...location,
			...{ latitude, longitude }
		};

		const consolidatedFormValues = {
			...this.orgMainForm.value,
			contact,
			...this.orgBonusForm.value,
			...this.orgSettingsForm.value
		};
		this.createOrganization.emit(consolidatedFormValues);
	}

	selectedTagsEvent(currentSelection: ITag[]) {
		this.orgMainForm.get('tags').setValue(currentSelection);
	}

	/*
	 * On Changed Currency Event Emitter
	 */
	currencyChanged($event: ICurrency) {}

	/*
	 * Google Place and Leaflet Map Coordinates Changed Event Emitter
	 */
	onCoordinatesChanges(
		$event: google.maps.LatLng | google.maps.LatLngLiteral
	) {
		const {
			loc: { coordinates }
		} = this.locationFormDirective.getValue();
		const [lat, lng] = coordinates;
		this.leafletTemplate.addMarker(new LatLng(lat, lng));
	}

	/*
	 * Leaflet Map Click Event Emitter
	 */
	onMapClicked(latlng: LatLng) {
		const { lat, lng }: LatLng = latlng;
		const location = this.locationFormDirective.getValue();
		this.locationFormDirective.setValue({
			...location,
			country: '',
			loc: {
				type: 'Point',
				coordinates: [lat, lng]
			}
		});
		this.locationFormDirective.onCoordinatesChanged();
	}

	/*
	 * Google Place Geometry Changed Event Emitter
	 */
	onGeometrySend(geometry: any) {}

	ngOnDestroy() {}
}
