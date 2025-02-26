import { Component, OnInit, Input } from '@angular/core';
import { first, firstValueFrom, tap } from 'rxjs';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Cell, LocalDataSource } from 'angular2-smart-table';
import { TranslateService } from '@ngx-translate/core';
import { ID, IEmployee, IOrganizationProjectModule, IOrganizationProjectModuleEmployee } from '@gauzy/contracts';
import { OrganizationProjectModuleService, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import {
	StatusViewComponent,
	ToggleSwitcherComponent,
	DateViewComponent,
	EmployeesMergedTeamsComponent,
	EmployeeWithLinksComponent
} from '../../table-components';
import { DeleteConfirmationComponent } from '../../user/forms/delete-confirmation/delete-confirmation.component';
import { ProjectModuleMutationComponent } from '../project-module-mutation/project-module-mutation.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-project-module-table',
	templateUrl: './project-module-table.component.html',
	styleUrl: './project-module-table.component.scss',
	standalone: false
})
export class ProjectModuleTableComponent extends TranslationBaseComponent implements OnInit {
	public modules: IOrganizationProjectModule[] = [];
	public selectedItem: IOrganizationProjectModule;
	public settingsSmartTable: object;
	public smartTableSource = new LocalDataSource();
	public loading: boolean = true;
	public disableButton: boolean = true;

	/**
	 * Project ID to fetch modules for.
	 * Uses getter and setter to detect changes and reload data if needed.
	 */
	private _projectId: ID;
	get projectId(): ID {
		return this._projectId;
	}
	@Input() set projectId(value: ID) {
		if (value !== this._projectId) {
			this._projectId = value;
			this.loadModules();
		}
	}

	constructor(
		public readonly translateService: TranslateService,
		private readonly dialogService: NbDialogService,
		private readonly toastrService: ToastrService,
		private readonly organizationProjectModuleService: OrganizationProjectModuleService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._applyTranslationOnSmartTable();
		this._loadSmartTableSettings();
	}

	/**
	 * Loads project modules for the given projectId.
	 */
	async loadModules() {
		if (!this.projectId) {
			return;
		}

		this.loading = true;
		try {
			const { items } = await firstValueFrom(
				this.organizationProjectModuleService.getAllModulesByProjectId({ projectId: this.projectId }, [
					'teams',
					'teams.members',
					'teams.members.employee',
					'teams.members.employee.user',
					'members',
					'members.employee',
					'members.employee.user',
					'tasks',
					'parent'
				])
			);
			this.modules = (items || []).map((module) => {
				return {
					...module,
					parentName: module.parent ? module.parent.name : '-',
					managers: this.getProjectModuleManagers(module),
					employeesMergedTeams: this.getNonManagerEmployees(module)
				};
			});
			this.smartTableSource.load(this.modules);
		} catch (error) {
			this.toastrService.danger('TOASTR.MESSAGE.SOMETHING_BAD_HAPPENED');
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Configures the settings for the Smart Table.
	 */
	_loadSmartTableSettings() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				name: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.NAME'),
					type: 'string'
				},
				isFavorite: {
					title: 'isFavorite',
					type: 'custom',
					width: '5%',
					isFilterable: false,
					renderComponent: ToggleSwitcherComponent,
					componentInitFunction: (instance: ToggleSwitcherComponent, cell: Cell) => {
						const module: IOrganizationProjectModule = cell.getRow().getData();
						instance.label = false;
						instance.value = module.isFavorite;

						// Update the module's isFavorite status
						instance.onSwitched.subscribe((toggle: boolean) => {
							this.updateModule(module.id, { ...module, isFavorite: toggle });
						});
					}
				},
				parentName: {
					title: this.getTranslation('PROJECT_MANAGEMENT_PAGE.PROJECT_MODULE.PARENT_MODULE'),
					type: 'string',
					class: 'text-wrap',
					isFilterable: false
				},
				status: {
					title: this.getTranslation('TASKS_PAGE.TASKS_STATUS'),
					type: 'custom',
					width: '10%',
					isFilterable: false,
					renderComponent: StatusViewComponent,
					componentInitFunction: (instance: StatusViewComponent, cell: Cell) => {
						instance.value = cell.getValue();
					}
				},
				startDate: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.EDIT.START_DATE'),
					type: 'custom',
					isFilterable: false,
					renderComponent: DateViewComponent,
					componentInitFunction: (instance: DateViewComponent, cell: Cell) => {
						instance.value = cell.getValue();
					}
				},
				endDate: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.EDIT.END_DATE'),
					type: 'custom',
					isFilterable: false,
					renderComponent: DateViewComponent,
					componentInitFunction: (instance: DateViewComponent, cell: Cell) => {
						instance.value = cell.getValue();
					}
				},
				managers: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.EDIT.TEAMS_PAGE.MANAGERS'),
					type: 'custom',
					isFilterable: false,
					renderComponent: EmployeeWithLinksComponent,
					componentInitFunction: (instance: EmployeesMergedTeamsComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getRawValue();
					}
				},
				employeesMergedTeams: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.EDIT.MEMBERS'),
					type: 'custom',
					renderComponent: EmployeesMergedTeamsComponent,
					componentInitFunction: (instance: EmployeesMergedTeamsComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getRawValue();
					}
				}
			}
		};
	}

	/**
	 * Handles row selection in the Smart Table.
	 * @param event Table row selection event.
	 */
	selectItem({ isSelected, data }) {
		this.selectedItem = isSelected ? data : null;
		this.disableButton = !isSelected;
	}

	/**
	 * Deletes the selected module and reloads the table.
	 */
	async delete() {
		const result = await firstValueFrom(this.dialogService.open(DeleteConfirmationComponent).onClose.pipe(first()));
		if (!result) return;

		try {
			await firstValueFrom(this.organizationProjectModuleService.delete(this.selectedItem.id));
			this.toastrService.success('TOASTR.MESSAGE.MODULE_DELETED');
			await this.loadModules();
		} catch {
			this.toastrService.danger('TOASTR.MESSAGE.SOMETHING_BAD_HAPPENED');
		}
	}

	/**
	 * Opens the edit dialog for the selected project module.
	 */
	async onEditProjectModuleDialog() {
		const dialogRef = this.dialogService.open(ProjectModuleMutationComponent, {
			context: {
				projectModule: this.selectedItem,
				createModule: false
			}
		});

		dialogRef.onClose.subscribe({
			next: (result) => {
				if (result) {
					this.loadModules();
				}
			},
			error: (err) => {
				console.error('Error in dialog onClose:', err);
			}
		});
	}

	/**
	 * Updates a module's properties and reloads the table if successful.
	 *
	 * @param id Module ID.
	 * @param changes Object containing the updated fields.
	 */
	private async updateModule(id: ID, changes: Partial<IOrganizationProjectModule>) {
		try {
			await firstValueFrom(this.organizationProjectModuleService.update(id, changes));
			this.toastrService.success('TOASTR.MESSAGE.MODULE_UPDATED');
			await this.loadModules();
		} catch {
			this.toastrService.danger('TOASTR.MESSAGE.SOMETHING_BAD_HAPPENED');
		}
	}

	/**
	 * Listens for language changes and triggers the loading of Smart Table settings.
	 * Unsubscribes when the component is destroyed.
	 */
	private _applyTranslationOnSmartTable(): void {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadSmartTableSettings()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Retrieves the project managers from the list of members.
	 *
	 * @param projectModule - The project module containing members.
	 * @returns A list of manager employees.
	 */
	getProjectModuleManagers(projectModule: IOrganizationProjectModule): IEmployee[] {
		return projectModule.members
			.filter((member: IOrganizationProjectModuleEmployee) => member.isManager)
			.map((member: IOrganizationProjectModuleEmployee) => member.employee);
	}

	/**
	 * Retrieves the non-manager employees from the list of members.
	 *
	 * @param projectModule - The project module containing members.
	 * @returns A list of non-manager employees as merged teams.
	 */
	getNonManagerEmployees(projectModule: IOrganizationProjectModule): IEmployee[][] {
		return [
			projectModule.members
				.filter((member: IOrganizationProjectModuleEmployee) => !member.isManager)
				.map((member: IOrganizationProjectModuleEmployee) => member.employee)
		];
	}
}
