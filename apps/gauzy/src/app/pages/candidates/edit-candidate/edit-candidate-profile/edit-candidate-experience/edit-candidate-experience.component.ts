import { OnInit, OnDestroy, Component } from '@angular/core';
import { Subject } from 'rxjs';
import { FormGroup, FormBuilder } from '@angular/forms';
import { Country, Candidate } from '@gauzy/models';
import { takeUntil } from 'rxjs/operators';
import { CandidateStore } from 'apps/gauzy/src/app/@core/services/candidate-store.service';

@Component({
	selector: 'ga-edit-candidate-experience',
	templateUrl: './edit-candidate-experience.component.html',
	styleUrls: ['./edit-candidate-experience.component.scss']
})
export class EditCandidateExperienceComponent implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	form: FormGroup;
	selectedCandidate: Candidate;

	constructor(
		private fb: FormBuilder,
		private candidateStore: CandidateStore
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
		this.form = this.fb.group({
			education: [candidate.education],
			experience: [candidate.experience],
			skills: [candidate.skills]
		});
	}
}
