import { OnInit, OnDestroy, Component, Input, ViewChild } from '@angular/core';
import { UntypedFormGroup, UntypedFormBuilder, Validators } from '@angular/forms';
import { IEmployee, ICandidate } from '@gauzy/contracts';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { LatLng } from 'leaflet';
import { LocationFormComponent } from '../../forms/location';
import { LeafletMapComponent } from '../../forms/maps';
import { Store } from '@gauzy/ui-sdk/common';
import { CandidateStore, EmployeeStore } from '../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-employee-location',
	templateUrl: './employee-location.component.html',
	styleUrls: ['./employee-location.component.scss']
})
export class EmployeeLocationComponent implements OnInit, OnDestroy {
	@Input() public isEmployee: boolean;
	@Input() public isCandidate: boolean;

	selectedEmployee: IEmployee;
	selectedCandidate: ICandidate;

	readonly form: UntypedFormGroup = LocationFormComponent.buildForm(this.fb);

	@ViewChild('locationFormDirective')
	locationFormDirective: LocationFormComponent;

	@ViewChild('leafletTemplate')
	leafletTemplate: LeafletMapComponent;

	constructor(
		private readonly fb: UntypedFormBuilder,
		private readonly candidateStore: CandidateStore,
		private readonly employeeStore: EmployeeStore,
		private readonly store: Store
	) {}

	ngOnInit() {
		this.employeeStore.selectedEmployee$
			.pipe(
				filter((employee: IEmployee) => !!employee),
				tap((employee: IEmployee) => (this.selectedEmployee = employee)),
				tap(() => this.setValidator()),
				tap((employee: IEmployee) => this._syncLocation(employee)),
				untilDestroyed(this)
			)
			.subscribe();
		this.candidateStore.selectedCandidate$
			.pipe(
				filter((candidate: ICandidate) => !!candidate),
				tap((candidate: ICandidate) => (this.selectedCandidate = candidate)),
				tap(() => this.setValidator()),
				tap((candidate: ICandidate) => this._syncLocation(candidate)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	submitForm() {
		if (!this.store.selectedOrganization || this.form.invalid) {
			return;
		}

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.store.selectedOrganization;

		const location = this.locationFormDirective.getValue();
		const { coordinates } = location['loc'];
		delete location['loc'];

		const [latitude, longitude] = coordinates;
		const contact = {
			...{ organizationId, tenantId },
			...location,
			...{ latitude, longitude }
		};

		if (this.isCandidate) {
			this.candidateStore.candidateForm = {
				contact,
				organizationId
			};
		}
		if (this.isEmployee) {
			this.employeeStore.employeeForm = {
				contact,
				organizationId
			};
		}
	}

	//Initialize form
	private _syncLocation(user: IEmployee | ICandidate) {
		if (!user.contact) {
			return;
		}
		setTimeout(() => {
			const { contact } = user;
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

	/*
	 * Google Place and Leaflet Map Coordinates Changed Event Emitter
	 */
	onCoordinatesChanges($event: google.maps.LatLng | google.maps.LatLngLiteral) {
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

	ngOnDestroy() {}
}
