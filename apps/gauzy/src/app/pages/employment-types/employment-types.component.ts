import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import {
	IEmployee,
	IOrganization,
	IOrganizationEmploymentType,
	ITag,
	ComponentLayoutStyleEnum
} from '@gauzy/models';
import { first, takeUntil } from 'rxjs/operators';
import { NbToastrService, NbDialogService } from '@nebular/theme';
import { Store } from '../../@core/services/store.service';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { OrganizationEmploymentTypesService } from '../../@core/services/organization-employment-types.service';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import { LocalDataSource } from 'ng2-smart-table';
import { NotesWithTagsComponent } from '../../@shared/table-components/notes-with-tags/notes-with-tags.component';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { Subject } from 'rxjs/internal/Subject';

@Component({
	selector: 'ga-employment-types',
	templateUrl: './employment-types.component.html',
	styleUrls: ['./employment-types.component.scss']
})
export class EmploymentTypesComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	form: FormGroup;
	showAddCard: Boolean;
	selectedEmployee: IEmployee;
	organization: IOrganization;
	organizationEmploymentTypes: IOrganizationEmploymentType[];
	tags: ITag[] = [];
	showEditDiv: Boolean = true;
	selectedOrgEmpType: IOrganizationEmploymentType;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	settingsSmartTable: object;
	smartTableSource = new LocalDataSource();
	private _ngDestroy$ = new Subject<void>();
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
		this._initializeForm();
		this.loadSmartTable();
		this._applyTranslationOnSmartTable();
		this.cancel();
	}

	ngOnDestroy(): void {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
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
							organizationId: this.organization.id,
							tenantId: this.organization.tenantId
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

	public async onKeyEnter($event) {
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
				this.selectedOrgEmpType = null;

				//when layout selector change then hide edit showcard
				this.showAddCard = false;
			});
	}

	private async addEmploymentType() {
		if (!this.form.invalid) {
			const newEmploymentType = {
				name: this.form.get('name').value,
				organizationId: this.organization.id,
				tenantId: this.organization.tenantId,
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

			this.emptyListInvoke();
		}
	}
	selectedTagsEvent(ev) {
		this.tags = ev;
	}
	gridEdit(empType: IOrganizationEmploymentType) {
		this.showAddCard = true;
		this.tags = empType.tags;
		this.selectedOrgEmpType = empType;
		this.form.patchValue(empType);
	}
	showEditCard(orgEmpType: IOrganizationEmploymentType) {
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
		this.cancel();
	}
	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.loadSmartTable();
			});
	}
	/*
	 * if empty employment types then displayed add button
	 */
	private emptyListInvoke() {
		if (this.organizationEmploymentTypes.length === 0) {
			this.showAddCard = false;
			this.selectedOrgEmpType = null;
		}
	}
}
