import { Component, OnInit, OnDestroy } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { UntypedFormGroup, UntypedFormBuilder, FormArray, Validators } from '@angular/forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ICandidateEducation, ComponentLayoutStyleEnum, IOrganization } from '@gauzy/contracts';
import { LocalDataSource, Cell } from 'angular2-smart-table';
import { DateViewComponent } from './../../../../../../@shared/table-components';
import { ComponentEnum } from '@gauzy/ui-sdk/common';
import { CandidateEducationsService, CandidateStore, Store, ToastrService } from './../../../../../../@core/services';
import { tap } from 'rxjs/operators';
import { PaginationFilterBaseComponent } from 'apps/gauzy/src/app/@shared/pagination/pagination-filter-base.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-edit-candidate-education',
	templateUrl: './edit-candidate-education.component.html',
	styleUrls: ['./edit-candidate-education.component.scss']
})
export class EditCandidateEducationComponent extends PaginationFilterBaseComponent implements OnInit, OnDestroy {
	public selectedOrganization: IOrganization;
	public showAddCard: boolean;
	public candidateId: string;
	public educationList: ICandidateEducation[] = [];
	public form: UntypedFormGroup;
	public settingsSmartTable: object;
	public sourceSmartTable = new LocalDataSource();
	public viewComponentName: ComponentEnum;
	public dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	public selectedEducation: ICandidateEducation;
	public disableButton = true;
	public loading: boolean;

	constructor(
		private readonly toastrService: ToastrService,
		readonly translateService: TranslateService,
		private readonly candidateStore: CandidateStore,
		private readonly fb: UntypedFormBuilder,
		private readonly store: Store,
		private readonly candidateEducationsService: CandidateEducationsService
	) {
		super(translateService);
		this.setView();
	}
	ngOnInit() {
		this.candidateStore.selectedCandidate$.pipe(untilDestroyed(this)).subscribe(async (candidate) => {
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
		this.form = new UntypedFormGroup({
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
		const selectedItem: ICandidateEducation = education ? education : this.selectedEducation;
		this.showAddCard = !this.showAddCard;
		this.educations.patchValue([selectedItem]);
		this.selectedEducation = selectedItem;
	}
	selectEducation({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedEducation = isSelected ? data : null;
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
		this.setPagination({
			...this.getPagination(),
			totalItems: this.sourceSmartTable.count()
		});
		this.loading = false;
	}
	async loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			selectedRowIndex: -1,
			columns: {
				schoolName: {
					title: this.getTranslation('CANDIDATES_PAGE.EDIT_CANDIDATE.SCHOOL_NAME'),
					type: 'string'
				},
				degree: {
					title: this.getTranslation('CANDIDATES_PAGE.EDIT_CANDIDATE.DEGREE'),
					type: 'string',
					filter: false
				},
				field: {
					title: this.getTranslation('CANDIDATES_PAGE.EDIT_CANDIDATE.FIELD'),
					type: 'string'
				},
				notes: {
					title: this.getTranslation('CANDIDATES_PAGE.EDIT_CANDIDATE.ADDITIONAL_NOTES'),
					type: 'string',
					filter: false
				},
				completionDate: {
					title: this.getTranslation('CANDIDATES_PAGE.EDIT_CANDIDATE.COMPLETION_DATE'),
					type: 'custom',
					filter: false,
					renderComponent: DateViewComponent,
					componentInitFunction: (instance: DateViewComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					}
				}
			}
		};
	}
	setView() {
		this.viewComponentName = ComponentEnum.EDUCATION;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(untilDestroyed(this))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
				this.selectedEducation = this.dataLayoutStyle === 'CARDS_GRID' ? null : this.selectedEducation;
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
				await this.candidateEducationsService.update(this.selectedEducation.id, {
					...formValue,
					organizationId,
					tenantId
				});
				this.toastrService.success('TOASTR.MESSAGE.CANDIDATE_EDUCATION_UPDATED', {
					name: formValue.schoolName
				});
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
				this.toastrService.success('TOASTR.MESSAGE.CANDIDATE_EDUCATION_CREATED', {
					name: formValue.schoolName
				});
				this.loadEducations();
			} catch (error) {
				this.toastrError(error);
			}
		}
		this.cancel();
	}
	async removeEducation(education: ICandidateEducation) {
		const selectedItem: ICandidateEducation = education ? education : this.selectedEducation;
		try {
			await this.candidateEducationsService.delete(selectedItem.id);
			this.selectedEducation = null;
			this.disableButton = true;
			this.toastrService.success('TOASTR.MESSAGE.CANDIDATE_EDUCATION_DELETED', {
				name: selectedItem.schoolName
			});
			this.loadEducations();
		} catch (error) {
			this.toastrError(error);
		}
	}
	private toastrError(error) {
		this.toastrService.danger(error);
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this.loadSmartTable()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/*
	 * Getter for educations form controls array
	 */
	get educations(): FormArray {
		return this.form.get('educations') as FormArray;
	}

	ngOnDestroy(): void {}
}
