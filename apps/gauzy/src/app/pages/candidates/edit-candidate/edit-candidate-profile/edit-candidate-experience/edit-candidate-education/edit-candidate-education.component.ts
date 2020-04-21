import { Component, OnInit, OnDestroy } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { FormGroup, FormBuilder, FormArray, Validators } from '@angular/forms';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { CandidateStore } from 'apps/gauzy/src/app/@core/services/candidate-store.service';
import { NbToastrService } from '@nebular/theme';
import { Education } from 'libs/models/src/lib/candidate-education.model';
import { CandidateEducationsService } from 'apps/gauzy/src/app/@core/services/candidate-educations.service';

@Component({
	selector: 'ga-edit-candidate-education',
	templateUrl: './edit-candidate-education.component.html',
	styleUrls: ['./edit-candidate-education.component.scss']
})
export class EditCandidateEducationComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	showAddCard: boolean;
	educationId = null;
	candidateId: string;
	educationList: Education[] = [];
	private _ngDestroy$ = new Subject<void>();
	form: FormGroup;
	constructor(
		private readonly toastrService: NbToastrService,
		readonly translateService: TranslateService,
		private candidateStore: CandidateStore,
		private fb: FormBuilder,
		private candidateEducationsService: CandidateEducationsService
	) {
		super(translateService);
	}
	ngOnInit() {
		this.candidateStore.selectedCandidate$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (candidate) => {
				if (candidate) {
					this.candidateId = candidate.id;
					this._initializeForm();
					this.loadEducations();
				}
			});
	}

	private async _initializeForm() {
		this.form = new FormGroup({
			educations: this.fb.array([])
		});
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
	editEducation(index: number, id: string) {
		this.showAddCard = !this.showAddCard;
		this.form.controls.educations.patchValue([this.educationList[index]]);
		this.educationId = id;
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
			const formValue = { ...educationForm.value[0] };
			if (this.educationId !== null) {
				//editing existing education
				try {
					await this.candidateEducationsService.update(
						this.educationId,
						{
							...formValue
						}
					);
					this.loadEducations();
					this.toastrSuccess('UPDATED');
				} catch (error) {
					this.toastrError(error);
				}
				this.educationId = null;
			} else {
				//creating education
				try {
					await this.candidateEducationsService.create({
						...formValue,
						candidateId: this.candidateId
					});
					this.toastrSuccess('CREATED');
					this.loadEducations();
				} catch (error) {
					this.toastrError(error);
				}
			}
			this.showAddCard = !this.showAddCard;
			educationForm.reset();
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
		try {
			await this.candidateEducationsService.delete(id);
			this.toastrSuccess('DELETED');
			this.loadEducations();
		} catch (error) {
			this.toastrError(error);
		}
	}

	private toastrError(error) {
		this.toastrService.danger(
			this.getTranslation('NOTES.CANDIDATE.EXPERIENCE.ERROR', {
				error: error.error ? error.error.message : error.message
			}),
			this.getTranslation('TOASTR.TITLE.ERROR')
		);
	}

	private toastrSuccess(text: string) {
		this.toastrService.success(
			this.getTranslation('TOASTR.TITLE.SUCCESS'),
			this.getTranslation(`TOASTR.MESSAGE.CANDIDATE_EXPERIENCE_${text}`)
		);
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
