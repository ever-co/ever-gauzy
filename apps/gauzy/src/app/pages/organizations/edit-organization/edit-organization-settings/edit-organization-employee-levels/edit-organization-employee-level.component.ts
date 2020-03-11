import { Component, OnInit } from '@angular/core';
import { EmployeeLevelInput } from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { OrganizationEditStore } from 'apps/gauzy/src/app/@core/services/organization-edit-store.service';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { EmployeeLevelService } from 'apps/gauzy/src/app/@core/services/employee-level.service';

@Component({
	selector: 'ga-edit-org-employee-level',
	templateUrl: './edit-organization-employee-levle.component.html'
})
export class EditOrganizationEmployeeLevelComponent
	extends TranslationBaseComponent
	implements OnInit {
	private _ngDestroy$ = new Subject<void>();

	organizationId: string;

	showAddCard: boolean;

	employeeLevels: EmployeeLevelInput[] = [];
	constructor(
		private readonly employeeLevlesService: EmployeeLevelService,
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

	async removeEmployeeLevel(id: string, name: string) {
		await this.employeeLevlesService.delete(id).toPromise();

		this.toastrService.primary(
			this.getTranslation(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_POSITIONS.REMOVE_POSITION',
				{
					name: name
				}
			),
			this.getTranslation('TOASTR.TITLE.SUCCESS')
		);

		this.loadEmployeeLevels();
	}

	private async addEmployeeLevel(level: string) {
		if (level) {
			await this.employeeLevlesService
				.create({
					level,
					organizationId: this.organizationId
				})
				.toPromise();

			this.toastrService.primary(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_POSITIONS.ADD_POSITION',
					{
						name: name
					}
				),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);

			this.showAddCard = !this.showAddCard;
			this.loadEmployeeLevels();
		} else {
			// TODO translate
			this.toastrService.danger(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_POSITIONS.INVALID_POSITION_NAME'
				),
				this.getTranslation(
					'TOASTR.MESSAGE.NEW_ORGANIZATION_POSITION_INVALID_NAME'
				)
			);
		}
	}

	async editEmployeeLevel(id: string, employeeLevelName: string) {
		const employeeLevel = {
			level: employeeLevelName,
			organizationId: this.organizationId
		};
		await this.employeeLevlesService.update(id, employeeLevel).toPromise();

		this.toastrService.primary('Employee Level successfuly updated');
	}

	private async loadEmployeeLevels() {
		const res = await this.employeeLevlesService
			.getAll(this.organizationId)
			.toPromise();
		if (res) {
			this.employeeLevels = res['items'];
		}
	}
}
