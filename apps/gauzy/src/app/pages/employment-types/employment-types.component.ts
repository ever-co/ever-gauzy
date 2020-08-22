import { Component, OnInit } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import {
	Employee,
	Organization,
	OrganizationEmploymentType,
	Tag,
	ComponentLayoutStyleEnum
} from '@gauzy/models';
import { takeUntil, first } from 'rxjs/operators';
import { NbToastrService, NbDialogService } from '@nebular/theme';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { Store } from '../../@core/services/store.service';
import { OrganizationEmploymentTypesService } from '../../@core/services/organization-employment-types.service';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import { LocalDataSource } from 'ng2-smart-table';
import { NotesWithTagsComponent } from '../../@shared/table-components/notes-with-tags/notes-with-tags.component';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';

@Component({
	selector: 'ga-employment-types',
	templateUrl: './employment-types.component.html'
})
export class EmploymentTypesComponent extends TranslationBaseComponent
	implements OnInit {
	private _ngDestroy$ = new Subject<void>();
	form: FormGroup;
	showAddCard: boolean;
	selectedEmployee: Employee;
	organization: Organization;
	organizationEmploymentTypes: OrganizationEmploymentType[];
	tags: Tag[] = [];
	showEditDiv: boolean = true;
	selectedOrgEmpType: OrganizationEmploymentType;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	settingsSmartTable: object;
	smartTableSource = new LocalDataSource();

	constructor(
		private fb: FormBuilder,
		private readonly toastrService: NbToastrService,
		private dialogService: NbDialogService,
		private store: Store,
		private organizationEmploymentTypesService: OrganizationEmploymentTypesService,
		readonly translateService: TranslateService
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit(): void {
		this.showEditDiv = !this.showEditDiv;
		this._initializeForm();
		this.loadSmartTable();
		this._applyTranslationOnSmartTable();
	}

	private _initializeForm() {
		this.form = this.fb.group({
			name: ['', Validators.required]
		});
		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((data) => {
				this.organization = data;
				if (this.organization) {
					this.organizationEmploymentTypesService
						.getAll(['tags'], {
							organizationId: this.organization.id
						})
						.pipe(takeUntil(this._ngDestroy$))
						.subscribe((types) => {
							this.organizationEmploymentTypes = types.items;
							this.smartTableSource.load(types.items);
						});
				}
			});
	}
	async loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				tags: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.NAME'),
					type: 'custom',
					class: 'align-row',
					renderComponent: NotesWithTagsComponent
				}
			}
		};
	}

	private async onKeyEnter($event) {
		if ($event.code === 'Enter') {
			this.addEmploymentType();
		}
	}
	setView() {
		this.viewComponentName = ComponentEnum.EMPLOYMENT_TYPE;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
			});
	}
	private async addEmploymentType() {
		if (!this.form.invalid) {
			const newEmploymentType = {
				name: this.form.get('name').value,
				organizationId: this.organization.id,
				tags: this.tags
			};
			this.organizationEmploymentTypesService
				.addEmploymentType(newEmploymentType)
				.pipe(takeUntil(this._ngDestroy$))
				.subscribe((data) => {
					this.organizationEmploymentTypes.push(data);
				});
			this.toastrService.primary(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_EMPLOYMENT_TYPES.ADD_EMPLOYMENT_TYPE',
					{
						name: this.form.get('name').value
					}
				),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
			this.showAddCard = !this.showAddCard;
		} else {
			this.toastrService.danger(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_EMPLOYMENT_TYPES.INVALID_EMPLOYMENT_TYPE'
				),
				this.getTranslation(
					'TOASTR.MESSAGE.NEW_ORGANIZATION_INVALID_EMPLOYMENT_TYPE'
				)
			);
		}
	}

	submitForm() {
		if (this.selectedOrgEmpType) {
			this.editOrgEmpType(
				this.selectedOrgEmpType.id,
				this.form.get('name').value
			);
		} else {
			this.addEmploymentType();
		}
	}

	async deleteEmploymentType(id, name) {
		const result = await this.dialogService
			.open(DeleteConfirmationComponent, {
				context: {
					recordType: 'Employment Type'
				}
			})
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			await this.organizationEmploymentTypesService.deleteEmploymentType(
				id
			);
			this.toastrService.primary(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_EMPLOYMENT_TYPES.DELETE_EMPLOYMENT_TYPE',
					{
						name: name
					}
				),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
			this.organizationEmploymentTypes = this.organizationEmploymentTypes.filter(
				(t) => t['id'] !== id
			);
		}
	}
	selectedTagsEvent(ev) {
		this.tags = ev;
	}
	gridEdit(empType: OrganizationEmploymentType) {
		this.showAddCard = true;
		this.tags = empType.tags;
		this.selectedOrgEmpType = empType;
		this.form.patchValue(empType);
	}
	showEditCard(orgEmpType: OrganizationEmploymentType) {
		this.showEditDiv = true;
		this.selectedOrgEmpType = orgEmpType;
		this.tags = orgEmpType.tags;
	}
	add() {
		this.showAddCard = true;
		this.form.reset();
		this.tags = [];
	}
	cancel() {
		this.showEditDiv = false;
		this.showAddCard = false;
		this.selectedOrgEmpType = null;
		this.form.reset();
		this.tags = [];
	}

	async editOrgEmpType(id: string, name: string) {
		const orgEmpTypeForEdit = {
			name: name,
			tags: this.tags
		};

		await this.organizationEmploymentTypesService.editEmploymentType(
			id,
			orgEmpTypeForEdit
		);
		this._initializeForm();
		this.showEditDiv = !this.showEditDiv;
		this.showAddCard = false;
		this.selectedOrgEmpType = null;
		this.tags = [];
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
