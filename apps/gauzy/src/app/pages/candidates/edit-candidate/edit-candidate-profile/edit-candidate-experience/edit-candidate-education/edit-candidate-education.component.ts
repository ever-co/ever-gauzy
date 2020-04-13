import { Component, OnInit } from '@angular/core';
import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { FormGroup, FormBuilder, FormArray, FormControl } from '@angular/forms';
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
	educations: Education[] = [
		{ schoolName: '111', degree: '2222' },
		{ schoolName: '3333', degree: '444' }
	];
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
					this._initializeForm(this.selectedCandidate.educations);
				}
			});
	}
	private async _initializeForm(educations: Education[]) {
		this.form = new FormGroup({
			educations: this.fb.array([])
		});
	}

	showEditCard(index: number) {
		this.showEditDiv[index] = true;
		this.showAddCard = !this.showAddCard;
	}

	addEducation() {
		const educations = this.form.controls.educations as FormArray;
		educations.push(
			this.fb.group({
				schoolName: '',
				degree: ''
				//field: [''],
				// completionDate: [''],
				// notes: ['']
			})
		);
		// console.log(educations.value);
	}
}
