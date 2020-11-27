import { OnInit, OnDestroy, Component, Input, ViewChild } from '@angular/core';
import { FormGroup, FormBuilder } from '@angular/forms';
import { IEmployee, ICandidate } from '@gauzy/models';
import { CandidateStore } from '../../../@core/services/candidate-store.service';
import { EmployeeStore } from '../../../@core/services/employee-store.service';
import { LocationFormComponent } from '../../forms/location';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter } from 'rxjs/operators';
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-employee-location',
	templateUrl: 'employee-location.component.html'
})
export class EmployeeLocationComponent implements OnInit, OnDestroy {
	@Input() public isEmployee: boolean;
	@Input() public isCandidate: boolean;

	selectedEmployee: IEmployee;
	selectedCandidate: ICandidate;

	readonly form: FormGroup = LocationFormComponent.buildForm(this.fb);
	@ViewChild('locationForm') locationForm: LocationFormComponent;

	constructor(
		private fb: FormBuilder,
		private candidateStore: CandidateStore,
		private employeeStore: EmployeeStore
	) {}

	ngOnInit() {
		this.employeeStore.selectedEmployee$
			.pipe(
				filter((employee) => !!employee),
				untilDestroyed(this)
			)
			.subscribe((employee) => {
				this.selectedEmployee = employee;
				if (this.selectedEmployee) {
					this._initializeForm(this.selectedEmployee);
				}
			});
		this.candidateStore.selectedCandidate$
			.pipe(
				filter((candidate) => !!candidate),
				untilDestroyed(this)
			)
			.subscribe((candidate) => {
				this.selectedCandidate = candidate;
				if (this.selectedCandidate) {
					this._initializeForm(this.selectedCandidate);
				}
			});
	}

	ngOnDestroy() {}

	async submitForm() {
		const location = this.locationForm.getValue();
		const { coordinates } = location['loc'];
		delete location['loc'];

		const contact = {
			...location,
			...{
				latitude: coordinates[0],
				longitude: coordinates[1]
			}
		};
		const contactData = {
			...this.form.value,
			contact
		};

		if (this.form.valid && this.isCandidate) {
			this.candidateStore.candidateForm = contactData;
		}
		if (this.form.valid && this.isEmployee) {
			this.employeeStore.employeeForm = contactData;
		}
	}

	//Initialize form
	private _initializeForm(employee: IEmployee | ICandidate) {
		if (!employee.contact) {
			return;
		}
		setTimeout(() => {
			const { contact } = employee;
			if (contact) {
				this.locationForm.setValue({
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

	onCoordinatesChanges(coordinates: number[]) {
		console.log(coordinates, 'coordinates');
	}

	onGeometrySend(geometry: any) {
		console.log(geometry, 'geometry');
	}
}
