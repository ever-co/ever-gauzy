import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { UntypedFormGroup, UntypedFormBuilder, FormArray, Validators } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { ICandidateTechnologies, IOrganization } from '@gauzy/contracts';
import { takeUntil } from 'rxjs/operators';
import { CandidateTechnologiesService, ToastrService } from '@gauzy/ui-core/core';
import { Store } from '@gauzy/ui-core/core';

@Component({
    selector: 'ga-candidate-technologies',
    templateUrl: './candidate-technologies.component.html',
    styleUrls: ['./candidate-technologies.component.scss'],
    standalone: false
})
export class CandidateTechnologiesComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	technologiesList: ICandidateTechnologies[];
	existedTechNames: string[];
	technologyNames: string[] = [];
	form: UntypedFormGroup;
	editId = null;
	organization: IOrganization;
	constructor(
		private fb: UntypedFormBuilder,
		private readonly toastrService: ToastrService,
		readonly translateService: TranslateService,
		private candidateTechnologiesService: CandidateTechnologiesService,
		private readonly store: Store
	) {
		super(translateService);
	}

	ngOnInit() {
		this.store.selectedOrganization$.pipe(takeUntil(this._ngDestroy$)).subscribe((organization: IOrganization) => {
			if (organization) {
				this.organization = organization;
				this._initializeForm();
				this.loadTechnologies();
			}
		});
	}

	cancel() {
		(this.form.controls.technologies as FormArray).reset();
	}
	private async _initializeForm() {
		this.form = new UntypedFormGroup({
			technologies: this.fb.array([])
		});
		const technologyForm = this.form.controls.technologies as FormArray;
		technologyForm.push(
			this.fb.group({
				name: ['', Validators.required]
			})
		);
		this.form.valueChanges.subscribe((item) => {
			this.existedTechNames = [];
			const enteredName = item.technologies[0].name;
			this.technologiesList.forEach((el) => {
				if (enteredName !== '' && el.name.toLocaleLowerCase().includes(enteredName)) {
					this.existedTechNames.push(el.name);
				}
			});
		});
	}

	private async loadTechnologies() {
		const { id: organizationId, tenantId } = this.organization;
		const res = await this.candidateTechnologiesService.getAll({
			organizationId,
			tenantId
		});
		if (res) {
			this.technologiesList = res.items.filter((item) => !item.interviewId);
			this.technologyNames = [];
			this.technologiesList.forEach((tech) => {
				this.technologyNames.push(tech.name.toLocaleLowerCase());
			});
		}
	}
	async save() {
		const { id: organizationId, tenantId } = this.organization;
		const technologiesForm = this.technologies as FormArray;
		const formValue = { ...technologiesForm.value[0] };
		const targetValue = Object.assign(formValue, {
			organizationId,
			tenantId
		});

		if (this.editId !== null) {
			this.update(targetValue);
		} else {
			this.create(targetValue);
		}
		technologiesForm.reset();
	}

	async update(formValue: ICandidateTechnologies) {
		if (!this.technologyNames.includes(formValue.name.toLocaleLowerCase())) {
			try {
				await this.candidateTechnologiesService.update(this.editId, {
					...formValue
				});
				this.editId = null;
				this.toastrService.success('TOASTR.MESSAGE.TECHNOLOGY_STACK_UPDATED', {
					name: formValue.name
				});
				this.loadTechnologies();
			} catch (error) {
				this.toastrError(error);
			}
		} else {
			this.toastrService.danger(
				this.getTranslation('CANDIDATES_PAGE.CRITERIONS.TOASTR_ALREADY_EXIST'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		}
	}

	async create(formValue: ICandidateTechnologies) {
		if (!this.technologyNames.includes(formValue.name.toLocaleLowerCase())) {
			try {
				await this.candidateTechnologiesService.create({
					...formValue
				});
				this.toastrService.success('TOASTR.MESSAGE.TECHNOLOGY_STACK_CREATED', {
					name: formValue.name
				});
				this.loadTechnologies();
			} catch (error) {
				this.toastrError(error);
			}
		} else {
			this.toastrService.danger('CANDIDATES_PAGE.CRITERIONS.TOASTR_ALREADY_EXIST');
		}
	}

	async edit(index: number, id: string) {
		this.editId = id;
		this.form.controls.technologies.patchValue([this.technologiesList[index]]);
	}
	async remove(technology: ICandidateTechnologies) {
		try {
			await this.candidateTechnologiesService.delete(technology.id);
			this.loadTechnologies();
			this.toastrService.success('TOASTR.MESSAGE.TECHNOLOGY_STACK_DELETED', {
				name: technology.name
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
	 * Getter for candidate technology form controls array
	 */
	get technologies(): FormArray {
		return this.form.get('technologies') as FormArray;
	}
}
