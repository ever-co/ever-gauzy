import { Component, OnInit, OnDestroy } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { ICandidate } from '@gauzy/contracts';
import { CandidateStore } from '@gauzy/ui-core/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy()
@Component({
    selector: 'ga-edit-candidate-hiring',
    templateUrl: './edit-candidate-hiring.component.html',
    styleUrls: ['./edit-candidate-hiring.component.scss'],
    standalone: false
})
export class EditCandidateHiringComponent implements OnInit, OnDestroy {
	form: UntypedFormGroup;
	selectedCandidate: ICandidate;

	constructor(private readonly fb: UntypedFormBuilder, private readonly candidateStore: CandidateStore) {}

	ngOnInit() {
		this.candidateStore.selectedCandidate$.pipe(untilDestroyed(this)).subscribe((candidate) => {
			this.selectedCandidate = candidate;

			if (this.selectedCandidate) {
				this._initializeForm(this.selectedCandidate);
			}
		});
	}

	async submitForm() {
		if (this.form.valid) {
			this.candidateStore.candidateForm = {
				...this.form.value
			};
		}
	}

	private _initializeForm(candidate: ICandidate) {
		this.form = this.fb.group({
			appliedDate: [candidate.appliedDate],
			hiredDate: [candidate.hiredDate],
			rejectDate: [candidate.rejectDate]
		});
	}

	ngOnDestroy() {}
}
