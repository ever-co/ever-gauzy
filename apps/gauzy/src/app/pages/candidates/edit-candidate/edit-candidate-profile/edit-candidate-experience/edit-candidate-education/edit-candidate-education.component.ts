import { Component, OnInit } from '@angular/core';
import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { FormGroup, FormBuilder } from '@angular/forms';
import { Candidate, Education } from '@gauzy/models';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { CandidateStore } from 'apps/gauzy/src/app/@core/services/candidate-store.service';

@Component({
	selector: 'ga-edit-candidate-education',
	templateUrl: './edit-candidate-education.component.html',
	styleUrls: ['./edit-candidate-education.component.scss']
})
export class EditCandidateEducationComponent extends TranslationBaseComponent
	implements OnInit {
	showAddCard: boolean;
	showEditDiv = [];
	private _ngDestroy$ = new Subject<void>();
	selectedCandidate: Candidate;
	form: FormGroup;
	constructor(
		private readonly toastrService: NbToastrService,
		readonly translateService: TranslateService,
		private candidateStore: CandidateStore,
		private fb: FormBuilder
	) {
		super(translateService);
	}
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
	private async _initializeForm(candidate: Candidate) {
		this.form = this.fb.group({
			schoolName: [
				candidate.education ? candidate.education.schoolName : null
			],
			degree: [candidate.education ? candidate.education.degree : null],
			field: [candidate.education ? candidate.education.field : null],
			completionDate: [
				candidate.education ? candidate.education.completionDate : null
			],
			notes: [candidate.education ? candidate.education.notes : null]
		});
	}
	// showEditCard( index: number) {
	// 	this.showEditDiv[index] = true;
	// 	this.showAddCard = !this.showAddCard;
	// }

	addEducation(education: Education) {
		console.log(education);
		this.form.valueChanges.subscribe((data) => console.log(data));
		this.showAddCard = !this.showAddCard;
		if (this.form.valid) {
			this.candidateStore.candidateForm = {
				...this.form.value
			};
		}
	}
}
