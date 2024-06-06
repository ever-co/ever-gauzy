import { Component, OnInit, OnDestroy, ViewChild, Input, AfterViewInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { LatLng } from 'leaflet';
import { IOrganization, CrudActionEnum } from '@gauzy/contracts';
import { Store, isNotEmpty } from '@gauzy/ui-sdk/common';
import { debounceTime, filter, map, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/i18n';
import { OrganizationEditStore, OrganizationsService, ToastrService } from '@gauzy/ui-sdk/core';
import { LeafletMapComponent, LocationFormComponent } from '../../../../../@shared/forms';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-edit-org-location',
	templateUrl: './edit-organization-location.component.html',
	styleUrls: ['./edit-organization-location.component.scss']
})
export class EditOrganizationLocationComponent
	extends TranslationBaseComponent
	implements AfterViewInit, OnInit, OnDestroy
{
	@Input() organization: IOrganization;

	readonly form: UntypedFormGroup = LocationFormComponent.buildForm(this.fb);

	@ViewChild('locationFormDirective')
	locationFormDirective: LocationFormComponent;

	@ViewChild('leafletTemplate')
	leafletTemplate: LeafletMapComponent;

	constructor(
		private readonly route: ActivatedRoute,
		private readonly fb: UntypedFormBuilder,
		private readonly organizationService: OrganizationsService,
		private readonly toastrService: ToastrService,
		private readonly organizationEditStore: OrganizationEditStore,
		private readonly store: Store,
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.setValidator();
	}

	ngAfterViewInit(): void {
		this.route.parent.data
			.pipe(
				debounceTime(100),
				filter((data) => !!data && !!data.organization),
				map(({ organization }) => organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap((organization: IOrganization) => (this.organizationEditStore.selectedOrganization = organization)),
				tap(() => this._setLocationFormValue()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	async updateOrganizationSettings(): Promise<void> {
		if (!this.organization || this.form.invalid) {
			return;
		}
		try {
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;

			const location = this.locationFormDirective.getValue();
			const { coordinates } = location['loc'];
			delete location['loc'];

			const [latitude, longitude] = coordinates;
			const contact = {
				organizationId,
				tenantId,
				latitude,
				longitude,
				...location
			};
			const rawValue = {
				...this.form.getRawValue(),
				name: this.organization.name,
				currency: this.organization.currency,
				defaultValueDateType: this.organization.defaultValueDateType,
				contact
			};

			const organization = await this.organizationService.update(this.organization.id, rawValue);
			if (organization) {
				this.organizationEditStore.organizationAction = {
					organization,
					action: CrudActionEnum.UPDATED
				};
				this.store.selectedOrganization = organization;
			}
			if (this.organization) {
				this.toastrService.success(`TOASTR.MESSAGE.ORGANIZATION_LOCATION_UPDATED`, {
					name: this.organization.name
				});
			}
		} catch (error) {
			console.log('Error while updating organization location', error);
			this.toastrService.danger(error);
		}
	}

	/**
	 * Initialized Location Form Value
	 *
	 * @returns
	 */
	private _setLocationFormValue(): void {
		if (!this.organization) {
			return;
		}
		setTimeout(() => {
			const organization: IOrganization = this.organization;
			const { contact } = organization;

			if (isNotEmpty(contact)) {
				if (this.locationFormDirective) {
					this.locationFormDirective.setValue({
						country: contact.country || null,
						city: contact.city || null,
						postcode: contact.postcode || null,
						address: contact.address || null,
						address2: contact.address2 || null,
						loc: {
							type: 'Point',
							coordinates: [contact.latitude || null, contact.longitude || null]
						}
					});
				}
				if (this.leafletTemplate) {
					this.leafletTemplate.addMarker(new LatLng(contact.latitude || null, contact.longitude || null));
				}
			}
		}, 200);
	}

	/*
	 * Google Place and Leaflet Map Coordinates Changed Event Emitter
	 */
	onCoordinatesChanges($event: google.maps.LatLng | google.maps.LatLngLiteral): void {
		const {
			loc: { coordinates }
		} = this.locationFormDirective.getValue();
		const [lat, lng] = coordinates;
		this.leafletTemplate.addMarker(new LatLng(lat, lng));
	}

	/*
	 * Leaflet Map Click Event Emitter
	 */
	onMapClicked(latlng: LatLng): void {
		if (this.locationFormDirective) {
			const { lat, lng }: LatLng = latlng;
			this.locationFormDirective.setValue({
				...this.locationFormDirective.getValue(),
				country: '',
				loc: {
					type: 'Point',
					coordinates: [lat, lng]
				}
			});
			this.locationFormDirective.onCoordinatesChanged();
		}
	}

	private setValidator(): void {
		if (!this.form) {
			return;
		}
		this.form.get('country').setValidators([Validators.required]);
		this.form.get('city').setValidators([Validators.required]);
		this.form.get('address').setValidators([Validators.required]);
		this.form.get('address2').setValidators([Validators.required]);
		this.form.get('postcode').setValidators([Validators.required]);
		this.form.updateValueAndValidity();
	}

	/*
	 * Google Place Geometry Changed Event Emitter
	 */
	onGeometrySend(geometry: any): void {}

	ngOnDestroy(): void {}
}
