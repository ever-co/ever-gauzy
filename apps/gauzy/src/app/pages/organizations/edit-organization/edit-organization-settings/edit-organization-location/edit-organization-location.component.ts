import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IOrganization } from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { OrganizationsService } from '../../../../../@core/services/organizations.service';
import { OrganizationEditStore } from '../../../../../@core/services/organization-edit-store.service';
import { filter, tap } from 'rxjs/operators';
import { TranslationBaseComponent } from '../../../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from '../../../../../@core/services/store.service';
import { LocationFormComponent } from '../../../../../@shared/forms/location';
import { LeafletMapComponent } from '../../../../../@shared/forms/maps/leaflet/leaflet.component';
import { LatLng } from 'leaflet';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-edit-org-location',
	templateUrl: './edit-organization-location.component.html',
	styleUrls: ['./edit-organization-location.component.scss']
})
export class EditOrganizationLocationComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	organization: IOrganization;
	country: string;
	readonly form: FormGroup = LocationFormComponent.buildForm(this.fb);

	@ViewChild('locationFormDirective')
	locationFormDirective: LocationFormComponent;

	@ViewChild('leafletTemplate')
	leafletTemplate: LeafletMapComponent;

	constructor(
		private router: Router,
		private fb: FormBuilder,
		private organizationService: OrganizationsService,
		private toastrService: NbToastrService,
		private organizationEditStore: OrganizationEditStore,
		private store: Store,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				tap((organization) => (this.organization = organization)),
				untilDestroyed(this)
			)
			.subscribe((organization) => {
				this._loadOrganizationData(organization);
			});
		this.setValidator();
	}

	async updateOrganizationSettings() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const location = this.locationFormDirective.getValue();
		const { coordinates } = location['loc'];
		delete location['loc'];

		const [latitude, longitude] = coordinates;
		const contact = {
			...{ organizationId, tenantId },
			...location,
			...{ latitude, longitude }
		};
		const contactData = {
			...this.form.value,
			contact
		};

		this.organizationService.update(this.organization.id, contactData);
		this.toastrService.primary(
			this.organization.name + ' organization location updated.',
			'Success'
		);
		this.goBack();
	}

	goBack() {
		this.router.navigate([
			`/pages/organizations/edit/${this.organization.id}`
		]);
	}

	//Initialize form
	private _initializeForm() {
		setTimeout(() => {
			if (!this.organization) {
				return;
			}

			const organization: IOrganization = this.organization;
			const { contact } = organization;
			if (contact) {
				this.locationFormDirective.setValue({
					country: contact.country,
					city: contact.city,
					postcode: contact.postcode,
					address: contact.address,
					address2: contact.address2,
					loc: {
						type: 'Point',
						coordinates: [contact.latitude, contact.longitude]
					}
				});
			}
		}, 200);
	}

	private async _loadOrganizationData(organization) {
		if (!organization) {
			return;
		}
		const id = organization.id;
		const { tenantId } = this.store.user;
		const { items } = await this.organizationService.getAll(
			['contact', 'tags'],
			{ id, tenantId }
		);
		this.organization = items[0];
		this._initializeForm();
		this.organizationEditStore.selectedOrganization = this.organization;
	}

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

	setValidator(): void {
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
	onGeometrySend(geometry: any) {}

	ngOnDestroy(): void {}
}
