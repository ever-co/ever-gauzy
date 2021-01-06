import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { FormGroup, FormBuilder, FormArray, Validators } from '@angular/forms';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { CandidateStore } from 'apps/gauzy/src/app/@core/services/candidate-store.service';
import { CandidateEducationsService } from 'apps/gauzy/src/app/@core/services/candidate-educations.service';
import {
	ICandidateEducation,
	ComponentLayoutStyleEnum,
	IOrganization
} from '@gauzy/models';
import { LocalDataSource } from 'ng2-smart-table';
import { ComponentEnum } from 'apps/gauzy/src/app/@core/constants/layout.constants';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { DateViewComponent } from 'apps/gauzy/src/app/@shared/table-components/date-view/date-view.component';
import { ToastrService } from 'apps/gauzy/src/app/@core/services/toastr.service';

@Component({
	selector: 'ga-edit-candidate-education',
	templateUrl: './edit-candidate-education.component.html',
	styleUrls: ['./edit-candidate-education.component.scss']
})
export class EditCandidateEducationComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	selectedOrganization: IOrganization;
	showAddCard: boolean;
	candidateId: string;
	educationList: ICandidateEducation[] = [];
	private _ngDestroy$ = new Subject<void>();
	form: FormGroup;
	settingsSmartTable: object;
	sourceSmartTable = new LocalDataSource();
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	selectedEducation: ICandidateEducation;
	disableButton = true;
	loading: boolean;
	@ViewChild('educationTable') educationTable;
	constructor(
		private readonly toastrService: ToastrService,
		readonly translateService: TranslateService,
		private candidateStore: CandidateStore,
		private fb: FormBuilder,
		private store: Store,
		private candidateEducationsService: CandidateEducationsService
	) {
		super(translateService);
		this.setView();
	}
	ngOnInit() {
		this.candidateStore.selectedCandidate$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (candidate) => {
				if (candidate) {
					this.candidateId = candidate.id;
					this.selectedOrganization = this.store.selectedOrganization;

					await this._initializeForm();
					await this.loadEducations();
					await this.loadSmartTable();
					this._applyTranslationOnSmartTable();
				}
			});
	}
	private async _initializeForm() {
		this.form = new FormGroup({
			educations: this.fb.array([])
		});
		const educationForm = this.educations;
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
	editEducation(education: ICandidateEducation) {
		const selectedItem: ICandidateEducation = education
			? education
			: this.selectedEducation;
		this.showAddCard = !this.showAddCard;
		this.educations.patchValue([selectedItem]);
		this.selectedEducation = selectedItem;
	}
	selectEducation({ isSelected, data }) {
		const selectedEducation = isSelected ? data : null;
		if (this.educationTable) {
			this.educationTable.grid.dataSet.willSelect = false;
		}
		this.disableButton = !isSelected;
		this.selectedEducation = selectedEducation;
	}
	showCard() {
		this.showAddCard = !this.showAddCard;
		this.educations.reset();
	}
	cancel() {
		this.showAddCard = false;
		this.educations.value.length = 0;
		this.selectedEducation = null;
		this.form.reset();
	}
	add() {
		this.showAddCard = true;
		this.selectedEducation = null;
		this.form.reset();
	}
	private async loadEducations() {
		this.loading = true;
		const { id: organizationId, tenantId } = this.selectedOrganization;
		const { items = [] } = await this.candidateEducationsService.getAll({
			candidateId: this.candidateId,
			organizationId,
			tenantId
		});
		this.educationList = items;
		this.sourceSmartTable.load(items);
		this.loading = false;
	}
	async loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				schoolName: {
					title: this.getTranslation(
						'CANDIDATES_PAGE.EDIT_CANDIDATE.SCHOOL_NAME'
					),
					type: 'string'
				},
				degree: {
					title: this.getTranslation(
						'CANDIDATES_PAGE.EDIT_CANDIDATE.DEGREE'
					),
					type: 'string',
					filter: false
				},
				field: {
					title: this.getTranslation(
						'CANDIDATES_PAGE.EDIT_CANDIDATE.FIELD'
					),
					type: 'string'
				},
				notes: {
					title: this.getTranslation(
						'CANDIDATES_PAGE.EDIT_CANDIDATE.ADDITIONAL_NOTES'
					),
					type: 'string',
					filter: false
				},
				completionDate: {
					title: this.getTranslation(
						'CANDIDATES_PAGE.EDIT_CANDIDATE.COMPLETION_DATE'
					),
					type: 'custom',
					renderComponent: DateViewComponent,
					filter: false
				}
			}
		};
	}
	setView() {
		this.viewComponentName = ComponentEnum.EDUCATION;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
				this.selectedEducation =
					this.dataLayoutStyle === 'CARDS_GRID'
						? null
						: this.selectedEducation;
			});
	}
	async submitForm() {
		const { id: organizationId, tenantId } = this.selectedOrganization;
		const educationForm = this.educations;
		if (educationForm.invalid) {
			this.toastrService.success(
				'TOASTR.MESSAGE.CANDIDATE_EDUCATION_REQUIRED',
				null,
				'NOTES.CANDIDATE.EXPERIENCE.INVALID_FORM'
			);
			return;
		}
		const formValue = { ...educationForm.value[0] };
		if (this.selectedEducation) {
			//editing existing education
			try {
				await this.candidateEducationsService.update(
					this.selectedEducation.id,
					{
						...formValue,
						organizationId,
						tenantId
					}
				);
				this.toastrService.success(
					'TOASTR.MESSAGE.CANDIDATE_EDUCATION_UPDATED',
					{
						name: formValue.schoolName
					}
				);
				this.loadEducations();
			} catch (error) {
				this.toastrError(error);
			}
		} else {
			//creating education
			try {
				await this.candidateEducationsService.create({
					...formValue,
					candidateId: this.candidateId,
					organizationId,
					tenantId
				});
				this.toastrService.success(
					'TOASTR.MESSAGE.CANDIDATE_EDUCATION_CREATED',
					{
						name: formValue.schoolName
					}
				);
				this.loadEducations();
			} catch (error) {
				this.toastrError(error);
			}
		}
		this.cancel();
	}
	async removeEducation(education: ICandidateEducation) {
		const selectedItem: ICandidateEducation = education
			? education
			: this.selectedEducation;
		try {
			await this.candidateEducationsService.delete(selectedItem.id);
			this.selectedEducation = null;
			this.disableButton = true;
			this.toastrService.success(
				'TOASTR.MESSAGE.CANDIDATE_EDUCATION_DELETED',
				{
					name: selectedItem.schoolName
				}
			);
			this.loadEducations();
		} catch (error) {
			this.toastrError(error);
		}
	}
	private toastrError(error) {
		this.toastrService.danger(error);
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
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
	get educations(): FormArray {
		return this.form.get('educations') as FormArray;
	}
}
