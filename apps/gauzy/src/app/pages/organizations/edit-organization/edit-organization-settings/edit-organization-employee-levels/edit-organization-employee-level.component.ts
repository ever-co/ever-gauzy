import { Component, OnInit } from '@angular/core';
import { EmployeeLevelInput, Tag } from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { OrganizationEditStore } from 'apps/gauzy/src/app/@core/services/organization-edit-store.service';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { EmployeeLevelService } from 'apps/gauzy/src/app/@core/services/employee-level.service';

@Component({
	selector: 'ga-edit-org-employee-level',
	templateUrl: './edit-organization-employee-level.component.html'
})
export class EditOrganizationEmployeeLevelComponent
	extends TranslationBaseComponent
	implements OnInit {
	private _ngDestroy$ = new Subject<void>();

	organizationId: string;

	showAddCard: boolean;
	showEditDiv: boolean;

	employeeLevels: EmployeeLevelInput[] = [];
	selectedEmployeeLevel: EmployeeLevelInput;
	tags: Tag[] = [];

	constructor(
		private readonly employeeLevelService: EmployeeLevelService,
		private readonly toastrService: NbToastrService,
		private readonly organizationEditStore: OrganizationEditStore,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.organizationEditStore.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((organization) => {
				if (organization) {
					this.organizationId = organization.id;
					this.loadEmployeeLevels();
				}
			});
	}

	private async loadEmployeeLevels() {
		const { items } = await this.employeeLevelService.getAll(
			this.organizationId,
			['tags']
		);

		if (items) {
			this.employeeLevels = items;
		}
	}

	async addEmployeeLevel(level: string) {
		if (level) {
			await this.employeeLevelService.create({
				level,
				organizationId: this.organizationId,
				tags: this.tags
			});

			this.toastrService.primary(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_EMPLOYEE_LEVELS.ADD_EMPLOYEE_LEVEL',
					{
						name
					}
				),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);

			this.showAddCard = !this.showAddCard;
			this.loadEmployeeLevels();
		} else {
			this.toastrService.danger(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_EMPLOYEE_LEVELS.INVALID_EMPLOYEE_LEVEL'
				),
				this.getTranslation(
					'TOASTR.MESSAGE.NEW_ORGANIZATION_EMPLOYEE_LEVEL_INVALID_NAME'
				)
			);
		}
	}

	async editEmployeeLevel(id: string, employeeLevelName: string) {
		const employeeLevel = {
			level: employeeLevelName,
			organizationId: this.organizationId,
			tags: this.tags
		};
		await this.employeeLevelService.update(id, employeeLevel);

		this.toastrService.primary(
			this.getTranslation('TOASTR.MESSAGE.EMPLOYEE_LEVEL_UPDATE'),
			this.getTranslation('TOASTR.TITLE.SUCCESS')
		);
		this.cancel();
		this.loadEmployeeLevels();
		this.tags = [];
	}

	async removeEmployeeLevel(id: string, name: string) {
		await this.employeeLevelService.delete(id);

		this.toastrService.primary(
			this.getTranslation(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_EMPLOYEE_LEVELS.REMOVE_EMPLOYEE_LEVEL',
				{
					name
				}
			),
			this.getTranslation('TOASTR.TITLE.SUCCESS')
		);

		this.loadEmployeeLevels();
	}

	showEditCard(employeeLevel: EmployeeLevelInput) {
		this.tags = employeeLevel.tags;
		this.showEditDiv = true;
		this.selectedEmployeeLevel = employeeLevel;
	}

	cancel() {
		this.showEditDiv = !this.showEditDiv;
		this.selectedEmployeeLevel = null;
	}

	selectedTagsEvent(ev) {
		this.tags = ev;
	}
}
