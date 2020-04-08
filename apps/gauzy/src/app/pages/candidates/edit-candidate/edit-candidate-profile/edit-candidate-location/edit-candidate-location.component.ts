import { OnInit, OnDestroy, Component } from '@angular/core';
import { Subject } from 'rxjs';
import { FormGroup, FormBuilder } from '@angular/forms';
import { Country, Candidate } from '@gauzy/models';
import { takeUntil } from 'rxjs/operators';
import { CountryService } from 'apps/gauzy/src/app/@core/services/country.service';
import { CandidateStore } from 'apps/gauzy/src/app/@core/services/candidate-store.service';
@Component({
	selector: 'ga-edit-candidate-location',
	templateUrl: './edit-candidate-location.component.html',
	styleUrls: ['./edit-candidate-location.component.scss']
})
export class EditCandidateLocationComponent implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	form: FormGroup;
	selectedCandidate: Candidate;
	countries: Country[];

	constructor(
		private fb: FormBuilder,
		private candidateStore: CandidateStore,
		private countryService: CountryService
	) {}

	ngOnInit() {
		this.candidateStore.selectedCandidate$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((candidate) => {
				this.selectedCandidate = candidate;
				if (this.selectedCandidate) {
					this._initializeForm(this.selectedCandidate);
				}
			});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
	}

	async submitForm() {
		if (this.form.valid) {
			this.candidateStore.candidateForm = {
				...this.form.value
			};
		}
	}

	private async _initializeForm(candidate: Candidate) {
		await this.loadCountries();

		this.form = this.fb.group({
			country: [candidate.country],
			city: [candidate.city],
			postcode: [candidate.postcode],
			address: [candidate.address],
			address2: [candidate.address2]
		});
	}

	private async loadCountries() {
		const { items } = await this.countryService.getAll();
		this.countries = items;
	}
}
