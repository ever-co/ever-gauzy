import { Component, OnInit, Input } from '@angular/core';
import { Cell, LocalDataSource } from 'angular2-smart-table';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { ID, IOrganizationProjectModule } from '@gauzy/contracts';
import { firstValueFrom } from 'rxjs';
import { first } from 'rxjs/operators';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { OrganizationProjectModuleService, ToastrService } from '@gauzy/ui-core/core';
import {
	AddProjectModuleDialogComponent,
	DateViewComponent,
	DeleteConfirmationComponent,
	EmployeeWithLinksComponent,
	StatusViewComponent,
	ToggleSwitcherComponent
} from '../../../../index';

@UntilDestroy()
@Component({
	selector: 'ngx-project-module-table',
	templateUrl: './project-module-table.component.html',
	styleUrls: ['./project-module-table.component.scss']
})
export class ProjectModuleTableComponent extends TranslationBaseComponent implements OnInit {
	private _projectId: ID;

	/**
	 * Project ID to fetch modules for.
	 * Uses getter and setter to detect changes and reload data if needed.
	 */
	@Input()
	get projectId(): ID {
		return this._projectId;
	}
	set projectId(value: ID) {
		if (value !== this._projectId) {
			this._projectId = value;
			this.loadModules();
		}
	}

	modules: IOrganizationProjectModule[] = [];
	selectedItem: IOrganizationProjectModule;
	settingsSmartTable: object;
	smartTableSource = new LocalDataSource();
	loading = true;
	disableButton = true;

	constructor(
		readonly translateService: TranslateService,
		private dialogService: NbDialogService,
		private toastrService: ToastrService,
		private organizationProjectModuleService: OrganizationProjectModuleService
	) {
		super(translateService);
	}

	async ngOnInit() {
		this.loadSmartTable();
		this._applyTranslationOnSmartTable();
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
				this.organizationProjectModuleService.get<IOrganizationProjectModule>({ projectId: this.projectId })
			);
			this.modules = items || [];
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
	loadSmartTable() {
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
							this.updateModule(module.id, { isFavorite: toggle });
						});
					}
				},
				description: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.DESCRIPTION'),
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
				manager: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.EDIT.TEAMS_PAGE.MANAGERS'),
					type: 'custom',
					isFilterable: false,
					renderComponent: EmployeeWithLinksComponent,
					componentInitFunction: (instance: EmployeeWithLinksComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
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
		const dialogRef = this.dialogService.open(AddProjectModuleDialogComponent, {
			context: {
				projectModule: this.selectedItem,
				createModule: false
			}
		});

		dialogRef.onClose.subscribe({
			next: (result) => {
				if (result) {
					this.updateModuleInTable(result);
				}
			},
			error: (err) => {
				console.error('Error in dialog onClose:', err);
			}
		});
	}

	/**
	 * Updates a module's properties and reloads the table if successful.
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
	 * Updates the specific module in the table without reloading all modules.
	 * @param updatedModule The updated module returned from the dialog.
	 */
	private updateModuleInTable(updatedModule: IOrganizationProjectModule) {
		const index = this.modules.findIndex((module) => module.id === updatedModule.id);
		if (index !== -1) {
			// Replace the existing module with the updated one
			this.modules[index] = updatedModule;
			this.smartTableSource.update(updatedModule, updatedModule);
			this.smartTableSource.refresh(); // Ensures the UI reflects the change
		}
	}
	/**
	 * Applies translations dynamically on Smart Table columns when the language changes.
	 */
	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange.pipe(untilDestroyed(this)).subscribe(() => {
			this.loadSmartTable();
		});
	}
}
