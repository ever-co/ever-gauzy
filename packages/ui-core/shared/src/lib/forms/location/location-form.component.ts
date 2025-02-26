import {
	Component,
	Input,
	EventEmitter,
	Output,
	ViewChild,
	ElementRef,
	AfterViewInit,
	Inject,
	Renderer2,
	ChangeDetectorRef
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { FormArray, UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { pick, isEmpty } from 'underscore';
import { ICountry, IGeoLocationCreateObject } from '@gauzy/contracts';
import { environment as env } from '@gauzy/ui-config';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { CountryService } from '@gauzy/ui-core/core';
import { convertPrecisionFloatDigit } from '@gauzy/ui-core/common';
import { FormHelpers } from '../helpers';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ga-location-form',
    styleUrls: ['./location-form.component.scss'],
    templateUrl: 'location-form.component.html',
    standalone: false
})
export class LocationFormComponent extends TranslationBaseComponent implements AfterViewInit {
	FormHelpers: typeof FormHelpers = FormHelpers;

	private _lastUsedAddressText: string;
	private _lat: number;
	private _lng: number;
	public showCoordinates: boolean;
	public country: string;
	public countries: ICountry[] = [];

	@Input() readonly form: UntypedFormGroup;

	/**
	 *
	 */
	private _showAutocompleteSearch: boolean = false;
	get showAutocompleteSearch(): boolean {
		return this._showAutocompleteSearch;
	}
	@Input() set showAutocompleteSearch(val: boolean) {
		this._showAutocompleteSearch = val;
	}

	/**
	 *
	 */
	private _showCoordinateInput: boolean = true;
	get showCoordinateInput(): boolean {
		return this._showCoordinateInput;
	}
	@Input() set showCoordinateInput(val: boolean) {
		this._showAutocompleteSearch = val;
	}

	//
	@Output() mapCoordinatesEmitter = new EventEmitter<google.maps.LatLng | google.maps.LatLngLiteral>();

	//
	@Output() mapGeometryEmitter = new EventEmitter<google.maps.places.PlaceGeometry | google.maps.GeocoderGeometry>();

	//
	@ViewChild('autocomplete') searchElement: ElementRef;

	/**
	 *
	 * @param fb
	 * @returns
	 */
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		const form = fb.group({
			country: [],
			city: [],
			address: [],
			address2: [],
			postcode: [],
			loc: fb.group({
				type: ['Point'],
				coordinates: fb.array([null, null])
			})
		});
		return form;
	}

	constructor(
		public readonly translateService: TranslateService,
		public readonly countryService: CountryService,
		private readonly cdr: ChangeDetectorRef,
		@Inject(DOCUMENT) private readonly _document: Document,
		private readonly renderer: Renderer2
	) {
		super(translateService);
		this.countryService.countries$
			.pipe(untilDestroyed(this))
			.subscribe((countries) => (this.countries = countries));
	}

	ngAfterViewInit() {
		const { GOOGLE_PLACE_AUTOCOMPLETE, GOOGLE_MAPS_API_KEY } = env;

		if (!GOOGLE_PLACE_AUTOCOMPLETE || !GOOGLE_MAPS_API_KEY) {
			this.showAutocompleteSearch = false;
		}

		this.cdr.detectChanges();
		this._removeGoogleAutocompleteApi();
		this._initGoogleAutocompleteApi();
	}

	/**
	 *
	 */
	get countryControl() {
		return this.form.get('country');
	}

	/**
	 *
	 */
	get cityControl() {
		return this.form.get('city');
	}

	/**
	 *
	 */
	get addressControl() {
		return this.form.get('address');
	}

	/**
	 *
	 */
	get address2Control() {
		return this.form.get('address2');
	}

	/**
	 *
	 */
	get postcodeControl() {
		return this.form.get('postcode');
	}

	/**
	 *
	 */
	get coordinates() {
		return this.form.get('loc').get('coordinates') as FormArray;
	}

	/**
	 *
	 */
	onAddressChanges() {
		if (this.showAutocompleteSearch) {
			this._tryFindNewAddress();
		}
	}

	/**
	 *
	 */
	onCoordinatesChanged() {
		if (this.showAutocompleteSearch) {
			this._tryFindNewCoordinates();
		}
	}

	/**
	 *
	 * @returns
	 */
	getValue(): IGeoLocationCreateObject {
		const location = this.form.getRawValue() as IGeoLocationCreateObject;
		if (!location.postcode) {
			delete location.postcode;
		}
		return location;
	}

	/**
	 *
	 * @param geoLocation
	 */
	setValue<T extends IGeoLocationCreateObject>(geoLocation: T) {
		if (this.form.controls) {
			FormHelpers.deepMark(this.form, 'dirty');
		}
		this.form.setValue({
			postcode: geoLocation.postcode || '',
			...(pick(geoLocation, Object.keys(this.getValue())) as any)
		});
		this.form.updateValueAndValidity();

		// This setup the form and map with new received values.
		this._tryFindNewCoordinates();
	}

	/**
	 *
	 */
	toggleShowCoordinates() {
		this.showCoordinates = !this.showCoordinates;
	}

	/**
	 *
	 */
	setDefaultCoords() {
		const lat = env.DEFAULT_LATITUDE;
		const lng = env.DEFAULT_LONGITUDE;
		if (lat && lng) {
			this.coordinates.setValue([lat, lng]);
			this.onCoordinatesChanged();
		}
	}

	/**
	 *
	 * @param address
	 */
	private _applyFormattedAddress(address: string) {
		if (this.searchElement) {
			this.searchElement.nativeElement.value = address;
		}
	}

	/**
	 *
	 * @returns
	 */
	private _tryFindNewAddress() {
		const { country, city, address, address2 } = this.form.value;
		if (isEmpty(address) || isEmpty(address2) || isEmpty(city) || isEmpty(country)) {
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

	/**
	 *
	 * @param location
	 */
	private _emitCoordinates(location: google.maps.LatLng | google.maps.LatLngLiteral) {
		this.mapCoordinatesEmitter.emit(location);
	}

	/**
	 *
	 * @param geometry
	 */
	private _emitGeometry(geometry: google.maps.places.PlaceGeometry | google.maps.GeocoderGeometry) {
		this.mapGeometryEmitter.emit(geometry);
	}

	/**
	 *
	 */
	private _popInvalidAddressMessage() {}

	/**
	 *
	 * @param autocomplete
	 */
	private _setupGoogleAutocompleteOptions(autocomplete: google.maps.places.Autocomplete) {
		autocomplete['setFields'](['address_components', 'geometry']);
	}

	/**
	 *
	 * @param place
	 * @param useGeometryLatLng
	 * @returns
	 */
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
			this._lat = convertPrecisionFloatDigit(loc.lat());
			this._lng = convertPrecisionFloatDigit(loc.lng());
		}

		this.coordinates.setValue([this._lat, this._lng]);

		// If the place has a geometry, then present it on a map.
		this._emitGeometry(place.geometry);

		this._emitCoordinates(new google.maps.LatLng(this._lat, this._lng));

		this._gatherAddressInformation(place);
	}

	/**
	 *
	 * @param autocomplete
	 */
	private _listenForGoogleAutocompleteAddressChanges(autocomplete: google.maps.places.Autocomplete) {
		autocomplete.addListener('place_changed', (_) => {
			const place: google.maps.places.PlaceResult = autocomplete.getPlace();
			this._applyNewPlaceOnTheMap(place);
		});
	}

	/**
	 *
	 * @param locationResult
	 */
	private _gatherAddressInformation(locationResult: google.maps.GeocoderResult | google.maps.places.PlaceResult) {
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

		let addressInput: string = '';
		let address2Input: string = ''; // is house number also
		let country: string = '';
		let postcode: string = '';
		let city: string = '';

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

		this._setFormLocationValues(country, city, addressInput, address2Input, postcode);
	}

	/*
	 * Removed multiple google place container before register new
	 */
	private _removeGoogleAutocompleteApi() {
		const body = this._document.body;
		const container = this._document.body.getElementsByClassName('pac-container');
		if (container.length > 0) {
			this.renderer.removeChild(body, container[0]);
		}
	}

	/**
	 * Initializes the Google Autocomplete API on the specified DOM element.
	 */
	private _initGoogleAutocompleteApi() {
		if (this.searchElement) {
			const autocomplete = new google.maps.places.Autocomplete(this.searchElement.nativeElement);
			this._setupGoogleAutocompleteOptions(autocomplete);
			this._listenForGoogleAutocompleteAddressChanges(autocomplete);
		}
	}

	/**
	 *
	 * @param country
	 * @param city
	 * @param address
	 * @param address2
	 * @param postcode
	 */
	private _setFormLocationValues(country: string, city: string, address: string, address2: string, postcode: string) {
		if (!isEmpty(country)) {
			const find = this.countries.find((item) => item.isoCode === country);
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

		this.form.updateValueAndValidity();
	}
}
