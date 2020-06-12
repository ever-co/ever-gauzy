import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { FormGroup, FormBuilder, FormArray, Validators } from '@angular/forms';
import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { ICandidateTechnologies } from '@gauzy/models';
import { CandidateTechnologiesService } from 'apps/gauzy/src/app/@core/services/candidate-technologies.service';

@Component({
	selector: 'ga-candidate-technologies',
	templateUrl: './candidate-technologies.component.html',
	styleUrls: ['./candidate-technologies.component.scss']
})
export class CandidateTechnologiesComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	technologiesList: ICandidateTechnologies[];
	form: FormGroup;
	editId = null;
	constructor(
		private fb: FormBuilder,
		private readonly toastrService: NbToastrService,
		readonly translateService: TranslateService,
		private candidateTechnologiesService: CandidateTechnologiesService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._initializeForm();
		this.loadTechnologies();
	}

	cancel() {
		(this.form.controls.technologies as FormArray).reset();
	}
	private async _initializeForm() {
		this.form = new FormGroup({
			technologies: this.fb.array([])
		});
		const technologyForm = this.form.controls.technologies as FormArray;
		technologyForm.push(
			this.fb.group({
				name: ['', Validators.required]
			})
		);
	}

	private async loadTechnologies() {
		const res = await this.candidateTechnologiesService.getAll();
		if (res) {
			this.technologiesList = res.items.filter(
				(item) => !item.interviewId
			);
		}
	}
	async save() {
		const technologiesForm = this.form.controls.technologies as FormArray;
		const formValue = { ...technologiesForm.value[0] };

		if (this.editId !== null) {
			this.update(formValue);
		} else {
			this.create(formValue);
		}
		technologiesForm.reset();
	}

	async update(formValue: ICandidateTechnologies) {
		try {
			await this.candidateTechnologiesService.update(this.editId, {
				...formValue
			});
			this.editId = null;
			this.toastrSuccess('UPDATED');
			this.loadTechnologies();
		} catch (error) {
			this.toastrError(error);
		}
	}

	async create(formValue: ICandidateTechnologies) {
		try {
			await this.candidateTechnologiesService.create({
				...formValue
			});
			this.toastrSuccess('CREATED');
			this.loadTechnologies();
		} catch (error) {
			this.toastrError(error);
		}
	}

	async edit(index: number, id: string) {
		this.editId = id;
		this.form.controls.technologies.patchValue([
			this.technologiesList[index]
		]);
	}
	async remove(id: string) {
		try {
			await this.candidateTechnologiesService.delete(id);
			this.loadTechnologies();
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
