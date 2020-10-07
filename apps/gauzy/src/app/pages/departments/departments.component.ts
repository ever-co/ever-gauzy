import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import {
	IEmployee,
	IOrganizationDepartment,
	IOrganizationDepartmentCreateInput,
	ITag,
	ComponentLayoutStyleEnum
} from '@gauzy/models';
import { NbToastrService, NbDialogService } from '@nebular/theme';
import { EmployeesService } from 'apps/gauzy/src/app/@core/services';
import { OrganizationDepartmentsService } from 'apps/gauzy/src/app/@core/services/organization-departments.service';
import { TranslateService } from '@ngx-translate/core';
import { first, takeUntil } from 'rxjs/operators';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { Store } from '../../@core/services/store.service';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import { LocalDataSource } from 'ng2-smart-table';
import { NotesWithTagsComponent } from '../../@shared/table-components/notes-with-tags/notes-with-tags.component';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { EmployeeWithLinksComponent } from '../../@shared/table-components/employee-with-links/employee-with-links.component';
import { Subject } from 'rxjs';

@Component({
	selector: 'ga-departments',
	templateUrl: './departments.component.html',
	styleUrls: ['./departments.component.scss']
})
export class DepartmentsComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	organizationId: string;
	tenantId: string;
	showAddCard: boolean;
	departments: IOrganizationDepartment[];
	employees: IEmployee[] = [];
	departmentToEdit: IOrganizationDepartment;
	tags: ITag[];
	isGridEdit: boolean;
	disableButton: boolean;
	selectedDepartment: any;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	settingsSmartTable: object;
	smartTableSource = new LocalDataSource();
	@ViewChild('departmentsTable') departmentsTable;

	constructor(
		private readonly organizationDepartmentsService: OrganizationDepartmentsService,
		private readonly toastrService: NbToastrService,
		private readonly employeesService: EmployeesService,
		readonly translateService: TranslateService,
		private dialogService: NbDialogService,
		private store: Store
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this.cancel();
		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((organization) => {
				if (organization) {
					this.organizationId = organization.id;
					this.tenantId = organization.tenantId;
					this.loadDepartments();
					this.loadEmployees();
					this.loadSmartTable();
					this._applyTranslationOnSmartTable();
				}
			});
	}
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
	cancel() {
		this.departmentToEdit = null;
		this.showAddCard = false;
		this.selectDepartment({
			isSelected: false,
			data: null
		});
	}
	selectDepartment({ isSelected, data }) {
		const selectedDepartment = isSelected ? data : null;
		if (this.departmentsTable) {
			this.departmentsTable.grid.dataSet.willSelect = false;
		}
		this.disableButton = !isSelected;
		this.selectedDepartment = selectedDepartment;
	}
	async loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				department_name: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.NAME'),
					type: 'string'
				},
				members: {
					title: this.getTranslation(
						'ORGANIZATIONS_PAGE.EDIT.TEAMS_PAGE.MEMBERS'
					),
					type: 'custom',
					renderComponent: EmployeeWithLinksComponent,
					filter: false
				},
				notes: {
					title: this.getTranslation('MENU.TAGS'),
					type: 'custom',
					class: 'align-row',
					renderComponent: NotesWithTagsComponent
				}
			}
		};
	}
	private async loadEmployees() {
		if (!this.organizationId) {
			return;
		}
		const { items } = await this.employeesService
			.getAll(['user'], {
				organization: {
					id: this.organizationId,
					tenantId: this.tenantId
				}
			})
			.pipe(first())
			.toPromise();

		this.employees = items;
	}

	setView() {
		this.viewComponentName = ComponentEnum.DEPARTMENTS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
				this.selectedDepartment =
					this.dataLayoutStyle === 'CARDS_GRID'
						? null
						: this.selectedDepartment;
			});
	}
	async removeDepartment(id?: string, name?: string) {
		const result = await this.dialogService
			.open(DeleteConfirmationComponent, {
				context: {
					recordType: 'Department'
				}
			})
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			await this.organizationDepartmentsService.delete(
				this.selectedDepartment ? this.selectedDepartment.id : id
			);
			this.toastrService.primary(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_DEPARTMENTS.REMOVE_DEPARTMENT',
					{
						name: this.selectedDepartment
							? this.selectedDepartment.department_name
							: name
					}
				),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
			this.cancel();
			this.loadDepartments();
		}
	}

	async editDepartment(department: IOrganizationDepartment) {
		this.departmentToEdit = department
			? department
			: this.selectedDepartment;
		this.isGridEdit = department ? false : true;
		this.showAddCard = true;
	}

	public async addOrEditDepartment(
		input: IOrganizationDepartmentCreateInput
	) {
		if (input.name) {
			this.departmentToEdit
				? await this.organizationDepartmentsService.update(
						this.departmentToEdit.id,
						input
				  )
				: await this.organizationDepartmentsService.create(input);

			this.cancel();

			this.toastrService.primary(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_DEPARTMENTS.ADD_DEPARTMENT',
					{
						name: input.name
					}
				),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
			this.loadDepartments();
		} else {
			this.toastrService.danger(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_DEPARTMENTS.INVALID_DEPARTMENT_NAME'
				),
				this.getTranslation(
					'TOASTR.MESSAGE.NEW_ORGANIZATION_DEPARTMENT_INVALID_NAME'
				)
			);
		}
	}

	private async loadDepartments() {
		if (!this.organizationId) {
			return;
		}

		const res = await this.organizationDepartmentsService.getAll(
			['members', 'members.user', 'tags'],
			{
				organizationId: this.organizationId,
				tenantId: this.tenantId
			}
		);
		if (res) {
			const result = [];
			this.departments = res.items;

			this.departments.forEach((dpt) =>
				result.push({
					id: dpt.id,
					department_name: dpt.name,
					members: dpt.members,
					tags: dpt.tags
				})
			);
			this.smartTableSource.load(result);
		}
	}
	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.loadSmartTable();
			});
	}
}
