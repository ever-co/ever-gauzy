import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { FormGroup, FormBuilder, FormArray, Validators } from '@angular/forms';
import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { CandidatePersonalQualitiesService } from 'apps/gauzy/src/app/@core/services/candidate-personal-qualities.service';
import { ICandidatePersonalQualities } from '@gauzy/models';

@Component({
	selector: 'ga-candidate-personal-qualities',
	templateUrl: './candidate-personal-qualities.component.html',
	styleUrls: ['./candidate-personal-qualities.component.scss']
})
export class CandidatePersonalQualitiesComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	personalQualitiesList: ICandidatePersonalQualities[];
	form: FormGroup;
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
		(this.form.controls.qualities as FormArray).reset();
	}

	private async _initializeForm() {
		this.form = new FormGroup({
			qualities: this.fb.array([])
		});
		const qualitiesForm = this.form.controls.qualities as FormArray;
		qualitiesForm.push(
			this.fb.group({
				name: ['', Validators.required]
			})
		);
	}

	private async loadQualities() {
		const res = await this.candidatePersonalQualitiesService.getAll();
		if (res) {
			this.personalQualitiesList = res.items.filter(
				(item) => !item.interviewId
			);
		}
	}
	async save() {
		const qualitiesForm = this.form.controls.qualities as FormArray;
		const formValue = { ...qualitiesForm.value[0] };

		if (this.editId !== null) {
			this.update(formValue);
		} else {
			this.create(formValue);
		}
		qualitiesForm.reset();
	}

	async update(formValue: ICandidatePersonalQualities) {
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

	async create(formValue: ICandidatePersonalQualities) {
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

	async edit(index: number, id: string) {
		this.editId = id;
		this.form.controls.qualities.patchValue([
			this.personalQualitiesList[index]
		]);
	}
	async remove(id: string) {
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
