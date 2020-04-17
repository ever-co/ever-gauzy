import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { FormGroup, FormBuilder, FormArray, Validators } from '@angular/forms';
import { Candidate } from '@gauzy/models';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { CandidateStore } from 'apps/gauzy/src/app/@core/services/candidate-store.service';
import { NbToastrService } from '@nebular/theme';
import { Experience } from 'libs/models/src/lib/candidate-experience.model';

@Component({
	selector: 'ga-edit-candidate-experience-form',
	templateUrl: './edit-candidate-experience-form.component.html',
	styleUrls: ['./edit-candidate-experience-form.component.scss']
})
export class EditCandidateExperienceFormComponent
	extends TranslationBaseComponent
	implements OnInit {
	showAddCard: boolean;
	editIndex = null;
	experience: Experience[] = [];
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
					this._initializeForm(this.selectedCandidate.experience);
					this.loadData();
				}
			});
	}
	private async _initializeForm(experience: Experience[]) {
		this.form = new FormGroup({
			experience: this.fb.array([])
		});
	}
	private async loadData() {
		const experienceForm = this.form.controls.experience as FormArray;
		experienceForm.push(
			this.fb.group({
				occupation: ['', Validators.required],
				organization: ['', Validators.required],
				duration: ['', Validators.required],
				description: ['']
			})
		);
	}
	editExperience(index: number) {
		this.showAddCard = !this.showAddCard;
		this.form.controls.experience.patchValue([this.experience[index]]);
		this.editIndex = index;
	}
	showCard() {
		this.showAddCard = !this.showAddCard;
		this.form.controls.experience.reset();
	}
	cancel() {
		this.showAddCard = !this.showAddCard;
		this.form.controls.experience.value.length = 0;
	}

	submitForm() {
		const experienceForm = this.form.controls.experience as FormArray;
		if (experienceForm.valid) {
			if (this.editIndex !== null) {
				const editValue = { ...this.form.controls.experience.value[0] };
				this.experience[this.editIndex] = editValue;
				this.editIndex = null;
			} else {
				this.experience.push(...this.form.controls.experience.value);
			}

			this.showAddCard = !this.showAddCard;
			this.form.controls.experience.reset();
			// to do  toastr for success
		} else {
			this.toastrService.danger(
				this.getTranslation('NOTES.CANDIDATE.EXPERIENCE.INVALID_FORM'),
				this.getTranslation(
					'TOASTR.MESSAGE.CANDIDATE_EXPERIENCE_REQUIRED'
				)
			);
		}
	}
	removeExperience(index: number) {
		this.experience.splice(index, 1);
	}
}
