import { Component, OnInit } from '@angular/core';
import {
	Employee,
	OrganizationDepartment,
	OrganizationDepartmentCreateInput,
	Tag
} from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { EmployeesService } from 'apps/gauzy/src/app/@core/services';
import { OrganizationDepartmentsService } from 'apps/gauzy/src/app/@core/services/organization-departments.service';
import { OrganizationEditStore } from 'apps/gauzy/src/app/@core/services/organization-edit-store.service';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { first, takeUntil } from 'rxjs/operators';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';

@Component({
	selector: 'ga-edit-org-departments',
	templateUrl: './edit-organization-departments.component.html',
	styleUrls: ['./edit-organization-departments.component.scss']
})
export class EditOrganizationDepartmentsComponent
	extends TranslationBaseComponent
	implements OnInit {
	private _ngDestroy$ = new Subject<void>();

	organizationId: string;

	showAddCard: boolean;

	departments: OrganizationDepartment[];
	employees: Employee[] = [];
	departmentToEdit: OrganizationDepartment;
	tags: Tag[];

	constructor(
		private readonly organizationDepartmentsService: OrganizationDepartmentsService,
		private readonly toastrService: NbToastrService,
		private readonly organizationEditStore: OrganizationEditStore,
		private readonly employeesService: EmployeesService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.organizationEditStore.selectedOrganization$
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
