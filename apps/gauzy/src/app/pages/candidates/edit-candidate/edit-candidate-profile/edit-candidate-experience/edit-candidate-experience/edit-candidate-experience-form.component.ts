import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { UntypedFormGroup, UntypedFormBuilder, FormArray, Validators } from '@angular/forms';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { ICandidateExperience, ComponentLayoutStyleEnum, IOrganization } from '@gauzy/contracts';
import { ComponentEnum, Store } from '@gauzy/ui-sdk/common';
import { LocalDataSource } from 'angular2-smart-table';
import { PaginationFilterBaseComponent } from 'apps/gauzy/src/app/@shared/pagination/pagination-filter-base.component';
import { CandidateExperienceService, CandidateStore, ToastrService } from '@gauzy/ui-sdk/core';

@Component({
	selector: 'ga-edit-candidate-experience-form',
	templateUrl: './edit-candidate-experience-form.component.html',
	styleUrls: ['./edit-candidate-experience-form.component.scss']
})
export class EditCandidateExperienceFormComponent extends PaginationFilterBaseComponent implements OnInit, OnDestroy {
	selectedOrganization: IOrganization;
	showAddCard: boolean;
	disableButton = true;
	experienceList: ICandidateExperience[] = [];
	private _ngDestroy$ = new Subject<void>();
	candidateId: string;
	form: UntypedFormGroup;
	selectedExperience: ICandidateExperience;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	settingsSmartTable: object;
	sourceSmartTable = new LocalDataSource();
	loading: boolean;
	@ViewChild('experienceTable') experienceTable;

	constructor(
		private readonly toastrService: ToastrService,
		readonly translateService: TranslateService,
		private candidateStore: CandidateStore,
		private fb: UntypedFormBuilder,
		private store: Store,
		private candidateExperienceService: CandidateExperienceService
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this.candidateStore.selectedCandidate$.pipe(takeUntil(this._ngDestroy$)).subscribe((candidate) => {
			if (candidate) {
				this.selectedOrganization = this.store.selectedOrganization;

				this.candidateId = candidate.id;
				this._initializeForm();
				this.loadExperience();
				this.loadSmartTable();
				this._applyTranslationOnSmartTable();
			}
		});
	}

	private async _initializeForm() {
		this.form = new UntypedFormGroup({
			experiences: this.fb.array([])
		});
		const experienceForm = this.experiences;
		experienceForm.push(
			this.fb.group({
				occupation: ['', Validators.required],
				// organization: ['', Validators.required],
				duration: ['', Validators.required],
				description: ['']
			})
		);
	}

	private async loadExperience() {
		this.loading = true;
		const { id: organizationId, tenantId } = this.selectedOrganization;
		const { items = [] } = await this.candidateExperienceService.getAll(
			{
				candidateId: this.candidateId,
				organizationId,
				tenantId
			},
			['organization']
		);
		this.experienceList = items;
		this.sourceSmartTable.load(items);
		this.setPagination({
			...this.getPagination(),
			totalItems: this.sourceSmartTable.count()
		});
		this.loading = false;
	}

	editExperience(experience: ICandidateExperience) {
		const selectedItem = experience ? experience : this.selectedExperience;
		this.showAddCard = true;
		this.experiences.patchValue([selectedItem]);
		this.selectedExperience = selectedItem;
	}

	showCard() {
		this.showAddCard = !this.showAddCard;
		this.experiences.reset();
	}

	cancel() {
		this.showAddCard = false;
		this.experiences.value.length = 0;
		this.selectedExperience = null;
		this.form.reset();
	}

	async submitForm() {
		const { id: organizationId, tenantId } = this.selectedOrganization;
		const experienceForm = this.experiences;
		if (experienceForm.invalid) {
			this.toastrService.danger(
				'TOASTR.MESSAGE.CANDIDATE_EXPERIENCE_REQUIRED',
				'NOTES.CANDIDATE.EXPERIENCE.INVALID_FORM'
			);
			return;
		}

		const formValue = { ...experienceForm.value[0] };
		if (this.selectedExperience) {
			//editing existing experience
			try {
				await this.candidateExperienceService.update(this.selectedExperience.id, {
					...formValue,
					organizationId,
					tenantId
				});
				this.loadExperience();
				this.toastrService.success('TOASTR.MESSAGE.CANDIDATE_EXPERIENCE_UPDATED', {
					name: formValue.occupation
				});
			} catch (error) {
				this.toastrError(error);
			}
		} else {
			//creating experience
			try {
				await this.candidateExperienceService.create({
					...formValue,
					candidateId: this.candidateId,
					organizationId,
					tenantId
				});
				this.toastrService.success('TOASTR.MESSAGE.CANDIDATE_EXPERIENCE_CREATED', {
					name: formValue.occupation
				});
				this.loadExperience();
			} catch (error) {
				this.toastrError(error);
			}
		}
		this.cancel();
	}

	async removeExperience(experience: ICandidateExperience) {
		const selectedItem = experience ? experience : this.selectedExperience;
		try {
			await this.candidateExperienceService.delete(selectedItem.id);
			this.selectedExperience = null;
			this.disableButton = true;
			this.toastrService.success('TOASTR.MESSAGE.CANDIDATE_EXPERIENCE_DELETED', {
				name: selectedItem.occupation
			});
			this.loadExperience();
		} catch (error) {
			this.toastrError(error);
		}
	}

	selectExperience({ isSelected, data }) {
		const selectedExperience = isSelected ? data : null;
		if (this.experienceTable) {
			this.experienceTable.grid.dataSet.willSelect = false;
		}
		this.disableButton = !isSelected;
		this.selectedExperience = selectedExperience;
	}

	add() {
		this.showAddCard = true;
		this.selectedExperience = null;
		this.form.reset();
	}

	async loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				occupation: {
					title: this.getTranslation('CANDIDATES_PAGE.EDIT_CANDIDATE.OCCUPATION'),
					type: 'string'
				},
				organization: {
					title: this.getTranslation('CANDIDATES_PAGE.EDIT_CANDIDATE.ORGANIZATION'),
					type: 'string',
					valuePrepareFunction: (value, item) => {
						if (item.hasOwnProperty('organization')) {
							return item.organization ? item.organization.name : null;
						}
						return value;
					}
				},
				duration: {
					title: this.getTranslation('CANDIDATES_PAGE.EDIT_CANDIDATE.DURATION'),
					type: 'string',
					filter: false
				},
				description: {
					title: this.getTranslation('CANDIDATES_PAGE.EDIT_CANDIDATE.DESCRIPTION'),
					type: 'string',
					filter: false
				}
			}
		};
	}

	private toastrError(error) {
		this.toastrService.danger(
			this.getTranslation('NOTES.CANDIDATE.EXPERIENCE.ERROR', {
				error: error.error ? error.error.message : error.message
			}),
			this.getTranslation('TOASTR.TITLE.ERROR')
		);
	}

	setView() {
		this.viewComponentName = ComponentEnum.EXPERIENCE;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
				this.selectedExperience = this.dataLayoutStyle === 'CARDS_GRID' ? null : this.selectedExperience;
			});
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange.subscribe(() => {
			this.loadSmartTable();
		});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}

	/*
	 * Getter for educations form controls array
	 */
	get experiences(): FormArray {
		return this.form.get('experiences') as FormArray;
	}
}
