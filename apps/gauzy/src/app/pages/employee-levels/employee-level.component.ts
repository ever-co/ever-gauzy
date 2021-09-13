import { Component, OnInit, OnDestroy } from '@angular/core';
import {
	IEmployeeLevelInput,
	ITag,
	ComponentLayoutStyleEnum,
	IOrganization
} from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import { filter, first } from 'rxjs/operators';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { LocalDataSource } from 'ng2-smart-table';
import { NotesWithTagsComponent } from '../../@shared/table-components/notes-with-tags/notes-with-tags.component';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { EmployeeLevelService, Store, ToastrService } from '../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-employee-level',
	templateUrl: './employee-level.component.html',
	styleUrls: ['employee-level.component.scss']
})
export class EmployeeLevelComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	organization: IOrganization;
	showAddCard: boolean;
	showEditDiv: boolean;

	employeeLevels: IEmployeeLevelInput[] = [];
	selectedEmployeeLevel: IEmployeeLevelInput;
	tags: ITag[] = [];
	isGridEdit: boolean;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	settingsSmartTable: object;
	smartTableSource = new LocalDataSource();

	constructor(
		private readonly employeeLevelService: EmployeeLevelService,
		private readonly dialogService: NbDialogService,
		private readonly toastrService: ToastrService,
		private readonly store: Store,
		readonly translateService: TranslateService
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe((organization) => {
				if (organization) {
					this.organization = organization;
					this.loadEmployeeLevels();
					this.loadSmartTable();
					this._applyTranslationOnSmartTable();
				}
			});
	}
	ngOnDestroy(): void {}

	private async loadEmployeeLevels() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const { items } = await this.employeeLevelService.getAll(
			['tags'],
			{ tenantId, organizationId }
		);

		if (items) {
			this.employeeLevels = items;
			this.smartTableSource.load(items);
		}

		await this.emptyListInvoke();
	}
	setView() {
		this.viewComponentName = ComponentEnum.EMPLOYEE_LEVELS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(untilDestroyed(this))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
				this.selectedEmployeeLevel = null;

				//when layout selector change then hide edit show card
				this.showAddCard = false;
			});
	}
	async loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				level: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.LEVEL'),
					type: 'custom',
					class: 'align-row',
					renderComponent: NotesWithTagsComponent
				}
			}
		};
	}
	async addEmployeeLevel(level: string) {
		if (level) {
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;

			await this.employeeLevelService.create({
				level,
				organizationId,
				tenantId,
				tags: this.tags
			});

			this.toastrService.success(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_EMPLOYEE_LEVELS.ADD_EMPLOYEE_LEVEL',
				{ name: level }
			);
			this.loadEmployeeLevels();
			this.cancel();
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
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const employeeLevel = {
			level: employeeLevelName,
			organizationId,
			tenantId,
			tags: this.tags
		};
		await this.employeeLevelService.update(id, employeeLevel);
		this.toastrService.success('TOASTR.MESSAGE.EMPLOYEE_LEVEL_UPDATE', {
			name: employeeLevelName
		});

		this.loadEmployeeLevels();
		this.cancel();
	}
	edit(employeeLevel: IEmployeeLevelInput) {
		this.showAddCard = true;
		this.isGridEdit = true;
		this.selectedEmployeeLevel = employeeLevel;
		this.tags = employeeLevel.tags;
	}
	save(name: string) {
		if (this.isGridEdit) {
			this.editEmployeeLevel(this.selectedEmployeeLevel.id, name);
		} else {
			this.addEmployeeLevel(name);
		}
	}
	async removeEmployeeLevel(id: string, name: string) {
		const result = await this.dialogService
			.open(DeleteConfirmationComponent, {
				context: {
					recordType: 'Employee level'
				}
			})
			.onClose.pipe(first())
			.toPromise();
		if (result) {
			await this.employeeLevelService.delete(id);
			this.toastrService.success(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_EMPLOYEE_LEVELS.REMOVE_EMPLOYEE_LEVEL',
				{ name }
			);
			this.loadEmployeeLevels();
		}
	}

	showEditCard(employeeLevel: IEmployeeLevelInput) {
		this.tags = employeeLevel.tags;
		this.showEditDiv = true;
		this.selectedEmployeeLevel = employeeLevel;
	}

	cancel() {
		this.showEditDiv = false;
		this.showAddCard = false;
		this.selectedEmployeeLevel = null;
		this.isGridEdit = false;
		this.tags = [];
	}

	selectedTagsEvent(ev) {
		this.tags = ev;
	}
	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.loadSmartTable();
			});
	}

	/*
	 * if empty employment levels then displayed add button
	 */
	private async emptyListInvoke() {
		if (this.employeeLevels.length === 0) {
			this.cancel();
		}
	}
}
