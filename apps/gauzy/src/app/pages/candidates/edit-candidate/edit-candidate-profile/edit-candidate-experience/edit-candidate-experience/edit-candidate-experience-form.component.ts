import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { FormGroup, FormBuilder, FormArray, Validators } from '@angular/forms';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { CandidateStore } from 'apps/gauzy/src/app/@core/services/candidate-store.service';
import { NbToastrService } from '@nebular/theme';
import { CandidateExperienceService } from 'apps/gauzy/src/app/@core/services/candidate-experience.service';
import { IExperience, ComponentLayoutStyleEnum } from '@gauzy/models';
import { ComponentEnum } from 'apps/gauzy/src/app/@core/constants/layout.constants';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { LocalDataSource } from 'ng2-smart-table';

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
	disableButton = true;
	experienceList: IExperience[] = [];
	private _ngDestroy$ = new Subject<void>();
	candidateId: string;
	form: FormGroup;
	selectedExperience: IExperience;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	settingsSmartTable: object;
	sourceSmartTable = new LocalDataSource();
	@ViewChild('experienceTable') experienceTable;
	constructor(
		private readonly toastrService: NbToastrService,
		readonly translateService: TranslateService,
		private candidateStore: CandidateStore,
		private fb: FormBuilder,
		private store: Store,
		private candidateExperienceService: CandidateExperienceService
	) {
		super(translateService);
		this.setView();
	}
	ngOnInit() {
		this.candidateStore.selectedCandidate$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((candidate) => {
				if (candidate) {
					this.candidateId = candidate.id;
					this._initializeForm();
					this.loadExperience();
					this.loadSmartTable();
					this._applyTranslationOnSmartTable();
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
			this.sourceSmartTable.load(res.items);
		}
	}
	editExperience(experience: IExperience) {
		const selectedItem = experience ? experience : this.selectedExperience;
		this.showAddCard = true;
		this.form.controls.experience.patchValue([selectedItem]);
		this.experienceId = experience ? experience.id : null;
	}
	showCard() {
		this.showAddCard = !this.showAddCard;
		this.form.controls.experience.reset();
	}
	cancel() {
		this.showAddCard = false;
		this.form.controls.experience.value.length = 0;
		this.experienceId = null;
		this.form.reset();
	}

	async submitForm() {
		const experienceForm = this.form.controls.experience as FormArray;
		if (experienceForm.valid) {
			const formValue = { ...experienceForm.value[0] };
			if (
				(this.dataLayoutStyle === 'CARDS_GRID' &&
					this.experienceId !== null) ||
				(this.dataLayoutStyle === 'TABLE' &&
					this.selectedExperience !== null)
			) {
				//editing existing experience
				try {
					await this.candidateExperienceService.update(
						this.experienceId
							? this.experienceId
							: this.selectedExperience.id,
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
	async removeExperience(experience: IExperience) {
		const selectedItem = experience ? experience : this.selectedExperience;
		try {
			await this.candidateExperienceService.delete(selectedItem.id);
			this.selectedExperience = null;
			this.disableButton = true;
			this.toastrSuccess('DELETED');
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
		this.form.reset();
	}
	async loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				occupation: {
					title: this.getTranslation(
						'CANDIDATES_PAGE.EDIT_CANDIDATE.OCCUPATION'
					),
					type: 'string'
				},
				organization: {
					title: this.getTranslation(
						'CANDIDATES_PAGE.EDIT_CANDIDATE.ORGANIZATION'
					),
					type: 'string'
				},
				duration: {
					title: this.getTranslation(
						'CANDIDATES_PAGE.EDIT_CANDIDATE.DURATION'
					),
					type: 'string',
					filter: false
				},
				description: {
					title: this.getTranslation(
						'CANDIDATES_PAGE.EDIT_CANDIDATE.DESCRIPTION'
					),
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
				this.selectedExperience =
					this.dataLayoutStyle === 'CARDS_GRID'
						? null
						: this.selectedExperience;
			});
	}
	private toastrSuccess(text: string) {
		this.toastrService.success(
			this.getTranslation('TOASTR.TITLE.SUCCESS'),
			this.getTranslation(`TOASTR.MESSAGE.CANDIDATE_EDIT_${text}`)
		);
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
}
