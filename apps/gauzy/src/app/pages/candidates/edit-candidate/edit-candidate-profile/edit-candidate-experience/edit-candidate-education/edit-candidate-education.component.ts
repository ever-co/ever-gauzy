import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { FormGroup, FormBuilder, FormArray, Validators } from '@angular/forms';
import { Candidate } from '@gauzy/models';
import { takeUntil, first } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { CandidateStore } from 'apps/gauzy/src/app/@core/services/candidate-store.service';
import { NbToastrService } from '@nebular/theme';
import { Education } from 'libs/models/src/lib/candidate-education.model';
import { CandidatesService } from 'apps/gauzy/src/app/@core/services/candidates.service';
import { ActivatedRoute } from '@angular/router';

@Component({
	selector: 'ga-edit-candidate-education',
	templateUrl: './edit-candidate-education.component.html',
	styleUrls: ['./edit-candidate-education.component.scss']
})
export class EditCandidateEducationComponent extends TranslationBaseComponent
	implements OnInit {
	showAddCard: boolean;
	isEdit = false;
	editIndex = null;
	educations: Education[] = [];
	private _ngDestroy$ = new Subject<void>();
	selectedCandidate: Candidate;
	form: FormGroup;
	constructor(
		private readonly toastrService: NbToastrService,
		readonly translateService: TranslateService,
		private candidateStore: CandidateStore,
		private fb: FormBuilder,
		private candidatesService: CandidatesService,
		private route: ActivatedRoute
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
					this.loadData();
				}
			});
		this.route.params
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (params) => {
				const id = params.id;
				const { items } = await this.candidatesService
					.getAll(['user', 'tags'], { id })
					.pipe(first())
					.toPromise();
				this.selectedCandidate = items[0];

				this.candidateStore.selectedCandidate = this.selectedCandidate;
			});
	}
	private async _initializeForm(educations: Education[]) {
		this.form = new FormGroup({
			educations: this.fb.array([])
		});
	}
	private async loadData() {
		const educationForm = this.form.controls.educations as FormArray;
		educationForm.push(
			this.fb.group({
				schoolName: ['', Validators.required],
				degree: ['', Validators.required],
				field: ['', Validators.required],
				completionDate: ['', Validators.required],
				notes: ['']
			})
		);
	}
	editEducation(index: number) {
		this.showAddCard = !this.showAddCard;
		this.form.controls.educations.patchValue([this.educations[index]]);
		this.isEdit = true;
		this.editIndex = index;
	}
	showCard() {
		this.showAddCard = !this.showAddCard;
		this.form.controls.educations.reset();
	}
	cancel() {
		this.showAddCard = !this.showAddCard;
		this.form.controls.educations.value.length = 0;
	}

	submitForm() {
		const educationForm = this.form.controls.educations as FormArray;
		if (educationForm.valid) {
			if (this.isEdit) {
				const editValue = { ...this.form.controls.educations.value[0] };
				this.educations[this.editIndex] = editValue;
				this.isEdit = false;
				this.editIndex = null;
			} else {
				this.educations.push(...this.form.controls.educations.value);
			}
			this.selectedCandidate.educations = this.educations;
			this.showAddCard = !this.showAddCard;
			this.form.controls.educations.reset();
			// to do  toastr for success
		} else {
			this.toastrService.danger(
				this.getTranslation('NOTES.CANDIDATE.EXPERIENCE.INVALID_FORM'),
				this.getTranslation(
					'TOASTR.MESSAGE.CANDIDATE_EDUCATION_REQUIRED'
				)
			);
		}
	}
	removeEducation(index: number) {
		this.educations.splice(index, 1);
		this.selectedCandidate.educations = this.educations;
	}
}
