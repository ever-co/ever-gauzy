import { Component, OnInit, OnDestroy } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { FormGroup, FormBuilder, FormArray, Validators } from '@angular/forms';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { CandidateStore } from 'apps/gauzy/src/app/@core/services/candidate-store.service';
import { NbToastrService } from '@nebular/theme';
import { CandidateExperienceService } from 'apps/gauzy/src/app/@core/services/candidate-experience.service';
import { IExperience } from '@gauzy/models';

@Component({
	selector: 'ga-edit-candidate-experience-form',
	templateUrl: './edit-candidate-experience-form.component.html',
	styleUrls: ['./edit-candidate-experience-form.component.scss']
})
export class EditCandidateExperienceFormComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	showAddCard: boolean;
	experienceId = null;
	experienceList: IExperience[] = [];
	private _ngDestroy$ = new Subject<void>();
	candidateId: string;
	form: FormGroup;
	constructor(
		private readonly toastrService: NbToastrService,
		readonly translateService: TranslateService,
		private candidateStore: CandidateStore,
		private fb: FormBuilder,
		private candidateExperienceService: CandidateExperienceService
	) {
		super(translateService);
	}
	ngOnInit() {
		this.candidateStore.selectedCandidate$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((candidate) => {
				if (candidate) {
					this.candidateId = candidate.id;
					this._initializeForm();
					this.loadExperience();
				}
			});
	}
	private async _initializeForm() {
		this.form = new FormGroup({
			experience: this.fb.array([])
		});
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
	private async loadExperience() {
		const res = await this.candidateExperienceService.getAll({
			candidateId: this.candidateId
		});
		if (res) {
			this.experienceList = res.items;
		}
	}
	editExperience(index: number, id: string) {
		this.showAddCard = !this.showAddCard;
		this.form.controls.experience.patchValue([this.experienceList[index]]);
		this.experienceId = id;
	}
	showCard() {
		this.showAddCard = !this.showAddCard;
		this.form.controls.experience.reset();
	}
	cancel() {
		this.showAddCard = !this.showAddCard;
		this.form.controls.experience.value.length = 0;
	}

	async submitForm() {
		const experienceForm = this.form.controls.experience as FormArray;
		if (experienceForm.valid) {
			const formValue = { ...experienceForm.value[0] };
			if (this.experienceId !== null) {
				//editing existing experience
				try {
					await this.candidateExperienceService.update(
						this.experienceId,
						{
							...formValue
						}
					);
					this.loadExperience();
					this.toastrSuccess('UPDATED');
					this.showAddCard = !this.showAddCard;
					this.form.controls.experience.reset();
				} catch (error) {
					this.toastrError(error);
				}
				this.experienceId = null;
			} else {
				//creating experience
				try {
					await this.candidateExperienceService.create({
						...formValue,
						candidateId: this.candidateId
					});
					this.toastrSuccess('CREATED');
					this.loadExperience();
					this.showAddCard = !this.showAddCard;
					this.form.controls.experience.reset();
				} catch (error) {
					this.toastrError(error);
				}
			}
		} else {
			this.toastrService.danger(
				this.getTranslation('NOTES.CANDIDATE.EXPERIENCE.INVALID_FORM'),
				this.getTranslation(
					'TOASTR.MESSAGE.CANDIDATE_EXPERIENCE_REQUIRED'
				)
			);
		}
	}
	async removeExperience(id: string) {
		try {
			await this.candidateExperienceService.delete(id);
			this.toastrSuccess('DELETED');
			this.loadExperience();
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
