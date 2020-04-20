import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { FormGroup, FormBuilder, FormArray, Validators } from '@angular/forms';
import { Candidate } from '@gauzy/models';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { CandidateStore } from 'apps/gauzy/src/app/@core/services/candidate-store.service';
import { NbToastrService } from '@nebular/theme';
import { Education } from 'libs/models/src/lib/candidate-education.model';
import { ActivatedRoute } from '@angular/router';
import { CandidateEducationsService } from 'apps/gauzy/src/app/@core/services/candidate-educations.service';

@Component({
	selector: 'ga-edit-candidate-education',
	templateUrl: './edit-candidate-education.component.html',
	styleUrls: ['./edit-candidate-education.component.scss']
})
export class EditCandidateEducationComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	showAddCard: boolean;
	editIndex = null;
	candidateId: string;
	educationList: Education[] = [];
	private _ngDestroy$ = new Subject<void>();
	selectedCandidate: Candidate;
	form: FormGroup;
	constructor(
		private readonly toastrService: NbToastrService,
		readonly translateService: TranslateService,
		private candidateStore: CandidateStore,
		private fb: FormBuilder,
		private candidateEducationsService: CandidateEducationsService,
		private route: ActivatedRoute
	) {
		super(translateService);
	}
	ngOnInit() {
		this.candidateStore.selectedCandidate$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (candidate) => {
				if (candidate) {
					console.log(candidate);
					this.candidateId = candidate.id;
					this._initializeForm();
					this.loadData();
					this.loadEducations();
				}
			});
	}
	private async _initializeForm() {
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
		this.form.controls.educations.patchValue([this.educationList[index]]);
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

	private async loadEducations() {
		const res = await this.candidateEducationsService.getAll({
			candidateId: this.candidateId
		});
		if (res) {
			this.educationList = res.items;
		}
	}
	async submitForm() {
		const educationForm = this.form.controls.educations as FormArray;
		if (educationForm.valid) {
			if (this.editIndex !== null) {
				// const editValue = { ...educationForm.value[0] };
				// await this.candidateEducationsService.update(this.editIndex, {
				// 	editValue
				// });
				this.loadEducations();
				this.toastrService.success('Successfully updated');
				this.editIndex = null;
			} else {
				const value = { ...educationForm.value };
				await this.candidateEducationsService.create({
					...value[0],
					candidateId: this.candidateId
				});
				this.loadEducations();
				this.toastrService.success('Successfully created');
			}
			this.showAddCard = !this.showAddCard;
			educationForm.reset();
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
	async removeEducation(id: string) {
		await this.candidateEducationsService.delete(id);
		// to do  toastr
		this.loadEducations();
	}
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
