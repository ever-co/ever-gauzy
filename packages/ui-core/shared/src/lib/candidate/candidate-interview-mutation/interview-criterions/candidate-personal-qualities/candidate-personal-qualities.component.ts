import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { UntypedFormGroup, UntypedFormBuilder, FormArray, Validators } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { ICandidatePersonalQualities, IOrganization } from '@gauzy/contracts';
import { takeUntil } from 'rxjs/operators';
import { CandidatePersonalQualitiesService, ToastrService } from '@gauzy/ui-core/core';
import { Store } from '@gauzy/ui-core/core';

@Component({
	selector: 'ga-candidate-personal-qualities',
	templateUrl: './candidate-personal-qualities.component.html',
	styleUrls: ['./candidate-personal-qualities.component.scss']
})
export class CandidatePersonalQualitiesComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	personalQualitiesList: ICandidatePersonalQualities[];
	form: UntypedFormGroup;
	editId = null;
	existedQualNames: string[];
	qualityNames: string[] = [];
	organization: IOrganization;
	constructor(
		private fb: UntypedFormBuilder,
		private readonly toastrService: ToastrService,
		readonly translateService: TranslateService,
		private candidatePersonalQualitiesService: CandidatePersonalQualitiesService,
		private readonly store: Store
	) {
		super(translateService);
	}

	ngOnInit() {
		this.store.selectedOrganization$.pipe(takeUntil(this._ngDestroy$)).subscribe((organization: IOrganization) => {
			if (organization) {
				this.organization = organization;
				this._initializeForm();
				this.loadQualities();
			}
		});
	}

	cancel() {
		(this.qualities as FormArray).reset();
	}

	private async _initializeForm() {
		this.form = new UntypedFormGroup({
			qualities: this.fb.array([])
		});
		const qualitiesForm = this.qualities as FormArray;
		qualitiesForm.push(
			this.fb.group({
				name: ['', Validators.required]
			})
		);
		this.form.valueChanges.subscribe((item) => {
			this.existedQualNames = [];
			const enteredName = item.qualities[0].name;
			this.personalQualitiesList.forEach((el) => {
				if (enteredName !== '' && el.name.toLocaleLowerCase().includes(enteredName)) {
					this.existedQualNames.push(el.name);
				}
			});
		});
	}

	private async loadQualities() {
		const { id: organizationId, tenantId } = this.organization;
		const res = await this.candidatePersonalQualitiesService.getAll({
			organizationId,
			tenantId
		});
		if (res) {
			this.personalQualitiesList = res.items.filter((item) => !item.interviewId);
			this.qualityNames = [];
			this.personalQualitiesList.forEach((tech) => {
				this.qualityNames.push(tech.name.toLocaleLowerCase());
			});
		}
	}
	async save() {
		const { id: organizationId, tenantId } = this.organization;
		const qualitiesForm = this.qualities as FormArray;
		const formValue = { ...qualitiesForm.value[0] };
		const targetValue = Object.assign(formValue, {
			organizationId,
			tenantId
		});

		if (this.editId !== null) {
			this.update(targetValue);
		} else {
			this.create(targetValue);
		}
		qualitiesForm.reset();
	}

	async update(formValue: ICandidatePersonalQualities) {
		if (!this.qualityNames.includes(formValue.name.toLocaleLowerCase())) {
			try {
				await this.candidatePersonalQualitiesService.update(this.editId, {
					...formValue
				});
				this.editId = null;
				this.toastrService.success('TOASTR.MESSAGE.PERSONAL_QUALITIES_UPDATED', {
					name: formValue.name
				});
				this.loadQualities();
			} catch (error) {
				this.toastrError(error);
			}
		} else {
			this.toastrService.danger('CANDIDATES_PAGE.CRITERIONS.TOASTR_ALREADY_EXIST');
		}
	}

	async create(formValue: ICandidatePersonalQualities) {
		if (!this.qualityNames.includes(formValue.name.toLocaleLowerCase())) {
			try {
				await this.candidatePersonalQualitiesService.create({
					...formValue
				});
				this.toastrService.success('TOASTR.MESSAGE.PERSONAL_QUALITIES_CREATED', {
					name: formValue.name
				});
				this.loadQualities();
			} catch (error) {
				this.toastrError(error);
			}
		} else {
			this.toastrService.danger('CANDIDATES_PAGE.CRITERIONS.TOASTR_ALREADY_EXIST');
		}
	}

	async edit(index: number, id: string) {
		this.editId = id;
		this.form.controls.qualities.patchValue([this.personalQualitiesList[index]]);
	}
	async remove(quantity: ICandidatePersonalQualities) {
		try {
			await this.candidatePersonalQualitiesService.delete(quantity.id);
			this.loadQualities();
			this.toastrService.success('TOASTR.MESSAGE.PERSONAL_QUALITIES_DELETED', {
				name: quantity.name
			});
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

	/*
	 * Getter for candidate qualities form controls array
	 */
	get qualities(): FormArray {
		return this.form.get('qualities') as FormArray;
	}
}
