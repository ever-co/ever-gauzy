import { ICandidatePersonalQualities } from './../../../../../../../libs/models/src/lib/candidate-personal-qualities.model';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { FormGroup, FormBuilder, FormArray, Validators } from '@angular/forms';
import { CandidatePersonalQualitiesService } from '../../../@core/services/candidate-personal-qualities.service';
import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';

@Component({
	selector: 'ga-candidate-criterions',
	templateUrl: './candidate-criterions.component.html',
	styleUrls: ['./candidate-criterions.component.scss']
})
export class CandidateCriterionsComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	personalQualitiesList: ICandidatePersonalQualities[];
	showAddCard: boolean;
	formQualities: FormGroup;
	formTechnologies: FormGroup;
	editId = null;
	constructor(
		private fb: FormBuilder,
		private readonly toastrService: NbToastrService,
		readonly translateService: TranslateService,
		private candidatePersonalQualitiesService: CandidatePersonalQualitiesService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._initializeForm();
		this.loadQualities();
	}

	cancel() {
		(this.formQualities.controls.qualities as FormArray).reset();
	}
	private async _initializeForm() {
		this.formQualities = new FormGroup({
			qualities: this.fb.array([])
		});
		const qualitiesForm = this.formQualities.controls
			.qualities as FormArray;
		qualitiesForm.push(
			this.fb.group({
				name: ['', Validators.required]
			})
		);

		this.formTechnologies = new FormGroup({
			technologies: this.fb.array([])
		});
		const technologyForm = this.formTechnologies.controls
			.technologies as FormArray;
		technologyForm.push(
			this.fb.group({
				name: ['', Validators.required]
			})
		);
	}

	private async loadQualities() {
		const res = await this.candidatePersonalQualitiesService.getAll();
		if (res) {
			this.personalQualitiesList = res.items;
		}
	}
	async saveQuality() {
		const qualitiesForm = this.formQualities.controls
			.qualities as FormArray;
		const formValue = { ...qualitiesForm.value[0] };

		if (this.editId !== null) {
			this.update(formValue);
		} else {
			this.create(formValue);
		}
		qualitiesForm.reset();
	}

	async update(formValue) {
		try {
			await this.candidatePersonalQualitiesService.update(this.editId, {
				...formValue
			});
			this.editId = null;
			this.toastrSuccess('UPDATED');
			this.loadQualities();
		} catch (error) {
			this.toastrError(error);
		}
	}

	async create(formValue) {
		try {
			await this.candidatePersonalQualitiesService.create({
				...formValue
			});
			this.toastrSuccess('CREATED');
			this.loadQualities();
		} catch (error) {
			this.toastrError(error);
		}
	}

	async editQuality(index: number, id: string) {
		this.editId = id;
		this.formQualities.controls.qualities.patchValue([
			this.personalQualitiesList[index]
		]);
	}
	async removeQuality(id: string) {
		try {
			await this.candidatePersonalQualitiesService.delete(id);
			this.loadQualities();
			this.toastrSuccess('DELETED');
		} catch (error) {
			this.toastrError(error);
		}
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
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
			this.getTranslation(`TOASTR.MESSAGE.CANDIDATE_EDIT_${text}`)
		);
	}
}
