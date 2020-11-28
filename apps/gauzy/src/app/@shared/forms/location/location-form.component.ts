import {
	Component,
	Input,
	EventEmitter,
	Output,
	ViewChild,
	ElementRef,
	AfterViewInit
} from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';

import { FormHelpers } from '../helpers';
import { pick, isEmpty } from 'lodash';
import { ICountry, IGeoLocationCreateObject } from '@gauzy/models';
import { environment } from '../../../../environments/environment';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { CountryService } from '../../../@core/services/country.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-location-form',
	styleUrls: ['./location-form.component.scss'],
	templateUrl: 'location-form.component.html'
})
export class LocationFormComponent
	extends TranslationBaseComponent
	implements AfterViewInit {
	private _lastUsedAddressText: string;
	private _lat: number;
	private _lng: number;
	private _showAutocompleteSearch = false;
	public showCoordinates: boolean;
	public country: string;
	public countries: ICountry[] = [];

	@Input()
	readonly form: FormGroup;

	@Input()
	set showAutocompleteSearch(val: boolean) {
		this._showAutocompleteSearch = val;
	}
	get showAutocompleteSearch(): boolean {
		return this._showAutocompleteSearch;
	}

	@Output()
	mapCoordinatesEmitter = new EventEmitter<
		google.maps.LatLng | google.maps.LatLngLiteral
	>();

	@Output()
	mapGeometryEmitter = new EventEmitter<
		google.maps.places.PlaceGeometry | google.maps.GeocoderGeometry
	>();

	@ViewChild('autocomplete') searchElement: ElementRef;

	static buildForm(formBuilder: FormBuilder): FormGroup {
		const form = formBuilder.group({
			country: ['', [Validators.required]],
			city: ['', [Validators.required]],
			address: ['', [Validators.required]],
			address2: [''],
			postcode: [''],
			loc: formBuilder.group({
				type: ['Point'],
				coordinates: formBuilder.array([null, null])
			})
		});
		return form;
	}

	constructor(
		public translateService: TranslateService,
		public countryService: CountryService
	) {
		super(translateService);
		this.countryService.countries$
			.pipe(untilDestroyed(this))
			.subscribe((countries) => (this.countries = countries));
	}

	ngAfterViewInit() {
		this._initGoogleAutocompleteApi();
	}

	isInvalidControl(control: string) {
		if (!this.form.contains(control)) {
			return true;
		}
		return this.form.get(control).touched && this.form.get(control).invalid;
	}

	get countryControl() {
		return this.form.get('country');
	}

	get cityControl() {
		return this.form.get('city');
	}

	get addressControl() {
		return this.form.get('address');
	}

	get address2Control() {
		return this.form.get('address2');
	}

	get postcodeControl() {
		return this.form.get('postcode');
	}

	get coordinates() {
		return this.form.get('loc').get('coordinates') as FormArray;
	}

	onAddressChanges() {
		if (this.showAutocompleteSearch) {
			this._tryFindNewAddress();
		}
	}

	onCoordinatesChanged() {
		if (this.showAutocompleteSearch) {
			this._tryFindNewCoordinates();
		}
	}

	getValue(): IGeoLocationCreateObject {
		const location = this.form.getRawValue() as IGeoLocationCreateObject;
		if (!location.postcode) {
			delete location.postcode;
		}
		return location;
	}

	setValue<T extends IGeoLocationCreateObject>(geoLocation: T) {
		FormHelpers.deepMark(this.form, 'dirty');
		this.form.setValue({
			postcode: geoLocation.postcode || '',
			...(pick(geoLocation, Object.keys(this.getValue())) as any)
		});
		this.form.updateValueAndValidity();

		// This setup the form and map with new received values.
		this._tryFindNewCoordinates();
	}

	toggleShowCoordinates() {
		this.showCoordinates = !this.showCoordinates;
	}

	setDefaultCoords() {
		const lat = environment.DEFAULT_LATITUDE;
		const lng = environment.DEFAULT_LONGITUDE;
		if (lat && lng) {
			this.coordinates.setValue([lat, lng]);
			this.onCoordinatesChanged();
		}
	}

	private _applyFormattedAddress(address: string) {
		if (this.searchElement) {
			this.searchElement.nativeElement.value = address;
		}
	}

	private _tryFindNewAddress() {
		const { country, city, address, address2 } = this.form.value;
		if (
			isEmpty(address) ||
			isEmpty(address2) ||
			isEmpty(city) ||
			isEmpty(country)
		) {
			return;
		}

		const newAddress = `${address}${address2}${city}${country}`;

		if (newAddress !== this._lastUsedAddressText) {
			this._lastUsedAddressText = newAddress;

			const geocoder = new google.maps.Geocoder();
			geocoder.geocode(
				{
					address: `${address} ${address2}, ${city}`,
					componentRestrictions: {
						country: country
					}
				},
				(results, status) => {
					if (status === google.maps.GeocoderStatus.OK) {
						const formattedAddress = results[0].formatted_address;
						const place: google.maps.GeocoderResult = results[0];

						this._applyNewPlaceOnTheMap(place);
						this._applyFormattedAddress(formattedAddress);
					}
				}
			);
		}
	}

	private _tryFindNewCoordinates() {
		const formCoordinates = this.coordinates.value;
		this._lat = formCoordinates[0];
		this._lng = formCoordinates[1];

		if (!this._lat || !this._lng) {
			return;
		}

		const geocoder = new google.maps.Geocoder();
		geocoder.geocode(
			{
				location: { lng: this._lng, lat: this._lat }
			},
			(results, status) => {
				if (status === google.maps.GeocoderStatus.OK) {
					const formattedAddress = results[0].formatted_address;
					const place = results[0];
					const useGeometryLatLng = false;
					this._applyNewPlaceOnTheMap(place, useGeometryLatLng);
					this._applyFormattedAddress(formattedAddress);
				}
			}
		);
	}

	private _emitCoordinates(
		location: google.maps.LatLng | google.maps.LatLngLiteral
	) {
		this.mapCoordinatesEmitter.emit(location);
	}

	private _emitGeometry(
		geometry:
			| google.maps.places.PlaceGeometry
			| google.maps.GeocoderGeometry
	) {
		this.mapGeometryEmitter.emit(geometry);
	}

	private _popInvalidAddressMessage() {}

	private _setupGoogleAutocompleteOptions(
		autocomplete: google.maps.places.Autocomplete
	) {
		autocomplete['setFields'](['address_components', 'geometry']);
	}

	private _applyNewPlaceOnTheMap(
		place: google.maps.places.PlaceResult | google.maps.GeocoderResult,
		useGeometryLatLng: boolean = true
	) {
		if (place.geometry === undefined || place.geometry === null) {
			this._popInvalidAddressMessage();
			return;
		}

		if (useGeometryLatLng) {
			const loc = place.geometry.location;
			this._lat = parseFloat(parseFloat(loc.lat().toString()).toFixed(6));
			this._lng = parseFloat(parseFloat(loc.lng().toString()).toFixed(6));
		}

		this.coordinates.setValue([this._lat, this._lng]);

		// If the place has a geometry, then present it on a map.
		this._emitGeometry(place.geometry);

		this._emitCoordinates(new google.maps.LatLng(this._lat, this._lng));

		this._gatherAddressInformation(place);
	}

	private _listenForGoogleAutocompleteAddressChanges(
		autocomplete: google.maps.places.Autocomplete
	) {
		autocomplete.addListener('place_changed', (_) => {
			const place: google.maps.places.PlaceResult = autocomplete.getPlace();
			this._applyNewPlaceOnTheMap(place);
		});
	}

	private _gatherAddressInformation(
		locationResult:
			| google.maps.GeocoderResult
			| google.maps.places.PlaceResult
	) {
		const longName = 'long_name';
		const shortName = 'short_name';

		const neededAddressTypes = {
			country: shortName,
			locality: longName,
			// 'neighborhood' is not need for now
			// neighborhood: longName,
			route: longName,
			intersection: longName,
			street_number: longName,
			postal_code: longName,
			administrative_area_level_1: shortName,
			administrative_area_level_2: shortName,
			administrative_area_level_3: shortName,
			administrative_area_level_4: shortName,
			administrative_area_level_5: shortName
		};

		let addressInput = '';
		let address2Input = ''; // is house number also
		let country = '';
		let postcode = '';
		let city = '';

		locationResult.address_components.forEach((address) => {
			const addressType = address.types[0];
			const addressTypeKey = neededAddressTypes[addressType];
			const val = address[addressTypeKey];
			if (val) {
				switch (addressType) {
					case 'country':
						country = val;
						break;
					case 'locality':
					case 'administrative_area_level_1':
					case 'administrative_area_level_2':
					case 'administrative_area_level_3':
					case 'administrative_area_level_4':
					case 'administrative_area_level_5':
						if (city === '') {
							city = val;
						}
						break;
					case 'route':
					case 'intersection':
						if (addressInput === '') {
							addressInput = val;
						}
						break;
					case 'street_number':
						address2Input = val;
						break;
					case 'postal_code':
						postcode = val;
						break;
				}
			}
		});

		this._setFormLocationValues(
			country,
			city,
			addressInput,
			address2Input,
			postcode
		);
	}

	private _initGoogleAutocompleteApi() {
		if (this.searchElement) {
			const autocomplete = new google.maps.places.Autocomplete(
				this.searchElement.nativeElement
			);
			this._setupGoogleAutocompleteOptions(autocomplete);
			this._listenForGoogleAutocompleteAddressChanges(autocomplete);
		}
	}

	private _setFormLocationValues(country, city, address, address2, postcode) {
		if (!isEmpty(country)) {
			const find = this.countries.find(
				(item) => item.isoCode === country
			);
			if (find) {
				this.country = find.isoCode;
				this.countryControl.setValue(this.country);
			}
		}
		if (!isEmpty(city)) {
			this.cityControl.setValue(city);
		}
		if (!isEmpty(postcode)) {
			this.postcodeControl.setValue(postcode);
		}
		if (!isEmpty(address)) {
			this.addressControl.setValue(address);
		}
		if (!isEmpty(address2)) {
			this.address2Control.setValue(address2);
		}
		this.coordinates.setValue([this._lat, this._lng]);
	}
}
