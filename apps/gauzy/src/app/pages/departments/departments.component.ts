import { Component, OnInit } from '@angular/core';
import {
	Employee,
	OrganizationDepartment,
	OrganizationDepartmentCreateInput,
	Tag,
	ComponentLayoutStyleEnum
} from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { EmployeesService } from 'apps/gauzy/src/app/@core/services';
import { OrganizationDepartmentsService } from 'apps/gauzy/src/app/@core/services/organization-departments.service';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { first, takeUntil } from 'rxjs/operators';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { Store } from '../../@core/services/store.service';
import { ComponentEnum } from '../../@core/constants/layout.constants';

@Component({
	selector: 'ga-departments',
	templateUrl: './departments.component.html',
	styleUrls: ['./departments.component.scss']
})
export class DepartmentsComponent extends TranslationBaseComponent
	implements OnInit {
	private _ngDestroy$ = new Subject<void>();

	organizationId: string;
	showAddCard: boolean;
	departments: OrganizationDepartment[];
	employees: Employee[] = [];
	departmentToEdit: OrganizationDepartment;
	tags: Tag[];
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;

	constructor(
		private readonly organizationDepartmentsService: OrganizationDepartmentsService,
		private readonly toastrService: NbToastrService,
		private readonly employeesService: EmployeesService,
		readonly translateService: TranslateService,
		private store: Store
	) {
		super(translateService);
	}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((organization) => {
				if (organization) {
					this.organizationId = organization.id;
					this.loadDepartments();
					this.loadEmployees();
				}
			});
	}

	cancel() {
		this.departmentToEdit = null;
		this.showAddCard = !this.showAddCard;
	}

	private async loadEmployees() {
		if (!this.organizationId) {
			return;
		}
		const { items } = await this.employeesService
			.getAll(['user'], { organization: { id: this.organizationId } })
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
			});
	}
	async removeDepartment(id: string, name: string) {
		await this.organizationDepartmentsService.delete(id);
		this.toastrService.primary(
			this.getTranslation(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_DEPARTMENTS.REMOVE_DEPARTMENT',
				{
					name: name
				}
			),
			this.getTranslation('TOASTR.TITLE.SUCCESS')
		);
		this.loadDepartments();
	}

	async editDepartment(department: OrganizationDepartment) {
		this.departmentToEdit = department;
		this.showAddCard = true;
	}

	private async addOrEditDepartment(
		input: OrganizationDepartmentCreateInput
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
				organizationId: this.organizationId
			}
		);
		if (res) {
			this.departments = res.items;
		}
	}
}
