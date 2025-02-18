import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { combineLatest, debounceTime, firstValueFrom, Subject } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { Cell } from 'angular2-smart-table';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	IOrganization,
	PermissionsEnum,
	ComponentLayoutStyleEnum,
	CrudActionEnum,
	ITag,
	IOrganizationProject,
	ID,
	IOrganizationProjectEmployee,
	IEmployee
} from '@gauzy/contracts';
import { API_PREFIX, ComponentEnum, distinctUntilChange } from '@gauzy/ui-core/common';
import {
	ErrorHandlingService,
	OrganizationProjectsService,
	OrganizationProjectStore,
	ServerDataSource,
	Store,
	ToastrService
} from '@gauzy/ui-core/core';
import {
	CardGridComponent,
	ContactLinksComponent,
	DateViewComponent,
	DeleteConfirmationComponent,
	EmployeesMergedTeamsComponent,
	EmployeeWithLinksComponent,
	PaginationFilterBaseComponent,
	ProjectModuleMutationComponent,
	ProjectOrganizationComponent,
	ProjectOrganizationEmployeesComponent,
	ProjectOrganizationGridComponent,
	ProjectOrganizationGridDetailsComponent,
	TagsColorFilterComponent,
	TagsOnlyComponent,
	VisibilityComponent
} from '@gauzy/ui-core/shared';
import { NgxPermissionsService } from 'ngx-permissions';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-project-list',
	templateUrl: './list.component.html',
	styleUrls: ['./list.component.scss']
})
export class ProjectListComponent extends PaginationFilterBaseComponent implements OnInit {
	public loading: boolean = false;
	public disableButton: boolean = true;
	public settingsSmartTable: any;
	public viewComponentName: ComponentEnum;
	public PermissionsEnum = PermissionsEnum;
	public dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	public componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	public selectedEmployeeId: ID | null;
	public selectedProject: IOrganizationProject;
	public organization: IOrganization;
	public smartTableSource: ServerDataSource;
	public projects: IOrganizationProject[] = [];
	public project$: Subject<boolean> = this.subject$;
	private _refresh$: Subject<boolean> = new Subject();

	/**
	 * Represents a component property for handling the project view.
	 */
	private _grid: CardGridComponent;
	@ViewChild('grid') set grid(content: CardGridComponent) {
		if (content) {
			this._grid = content;
		}
	}

	constructor(
		public readonly translateService: TranslateService,
		private readonly _httpClient: HttpClient,
		private readonly _router: Router,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly _organizationProjectsService: OrganizationProjectsService,
		private readonly _toastrService: ToastrService,
		private readonly _store: Store,
		private readonly _dialogService: NbDialogService,
		private readonly _organizationProjectStore: OrganizationProjectStore,
		private readonly _permissionsService: NgxPermissionsService
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit(): void {
		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();

		const storeOrganization$ = this._store.selectedOrganization$;
		const storeEmployee$ = this._store.selectedEmployee$;
		combineLatest([storeOrganization$, storeEmployee$])
			.pipe(
				distinctUntilChange(),
				filter(([organization]) => !!organization),
				tap(([organization, employee]) => {
					this.organization = organization;
					this.selectedEmployeeId = employee ? employee.id : null;
				}),
				tap(() => this._refresh$.next(true)),
				tap(() => this.project$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.project$
			.pipe(
				debounceTime(150),
				tap(() => (this.loading = true)),
				tap(() => this.loadProjects()),
				untilDestroyed(this)
			)
			.subscribe();
		this.pagination$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				tap(() => this.project$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this._refresh$
			.pipe(
				filter(() => this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => this.refreshPagination()),
				tap(() => (this.projects = [])),
				untilDestroyed(this)
			)
			.subscribe();
	}

	setView() {
		this.viewComponentName = ComponentEnum.PROJECTS;

		// Subscribe to changes in component layout style
		this._store
			.componentLayout$(this.viewComponentName)
			.pipe(
				tap((componentLayout: ComponentLayoutStyleEnum) => {
					this.dataLayoutStyle = componentLayout;
					this._loadSmartTableSettings();
					this.refreshPagination();
				}),
				debounceTime(300),
				untilDestroyed(this) // Automatically unsubscribe on component destruction
			)
			.subscribe((componentLayout: ComponentLayoutStyleEnum) => {
				// Handle specific actions for the grid layout
				if (componentLayout === this.componentLayoutStyleEnum.CARDS_GRID) {
					this.projects = [];
					this.project$.next(true);
				}
			});
	}

	/**
	 * Remove a project after confirming deletion.
	 * @param selectedItem The project to be removed.
	 */
	async removeProject(selectedItem: IOrganizationProject) {
		if (!selectedItem) {
			return;
		}

		this.selectProject({
			isSelected: true,
			data: selectedItem
		});

		try {
			const result = await firstValueFrom(
				this._dialogService.open(DeleteConfirmationComponent, {
					context: {
						recordType: 'Project'
					}
				}).onClose
			);

			if (result) {
				const { id, name } = this.selectedProject;
				await this._organizationProjectsService.delete(id);

				this._organizationProjectStore.organizationProjectAction = {
					project: this.selectedProject,
					action: CrudActionEnum.DELETED
				};

				this._toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_PROJECTS.REMOVE_PROJECT', { name });

				this.cancel();
				this._refresh$.next(true);
				this.project$.next(true);
			}
		} catch (error) {
			console.error('Error while removing project', error?.message);
			this._errorHandlingService.handleError(error);
		}
	}

	/**
	 * Cancels the current selection of a project.
	 */
	cancel() {
		this.selectProject({
			isSelected: false,
			data: null
		});
	}

	/**
	 * Registers the Smart Table Source configuration.
	 */
	setSmartTableSource() {
		if (!this.organization) {
			return;
		}

		// Extract organization ID and tenant ID from the organization object
		const { id: organizationId, tenantId } = this.organization;

		this.smartTableSource = new ServerDataSource(this._httpClient, {
			endPoint: `${API_PREFIX}/organization-projects/pagination`,
			relations: ['organizationContact', 'members.employee.user', 'tags', 'teams'],
			join: {
				alias: 'organization_project',
				leftJoin: {
					tags: 'organization_project.tags'
				}
			},
			where: {
				organizationId,
				tenantId,
				...(this.selectedEmployeeId
					? {
							members: {
								employeeId: this.selectedEmployeeId
							}
					  }
					: {}),
				...(this.filters.where ? this.filters.where : {})
			},
			resultMap: (project: IOrganizationProject) => {
				return Object.assign({}, project, {
					...this.privatePublicProjectMapper(project),
					managers: this.getProjectManagers(project),
					employeesMergedTeams: this.getNonManagerEmployees(project)
				});
			},
			finalize: () => {
				if (this._isGridCardLayout) {
					const projects = this.smartTableSource.getData();
					this.projects.push(...projects);
				}
				this.setPagination({
					...this.getPagination(),
					totalItems: this.smartTableSource.count()
				});
			}
		});
	}

	/**
	 * Retrieves the project managers from the list of members.
	 *
	 * @param project - The project containing members.
	 * @returns A list of manager employees.
	 */
	getProjectManagers(project: IOrganizationProject): IEmployee[] {
		return project.members
			.filter((member: IOrganizationProjectEmployee) => member.isManager)
			.map((member: IOrganizationProjectEmployee) => member.employee);
	}

	isManagerOfProject(project: IOrganizationProject): boolean {
		return project.members.some((member) => member.isManager && member.employee.userId === this._store.user.id);
	}

	/**
	 * Retrieves the non-manager employees from the list of members.
	 *
	 * @param project - The project containing members.
	 * @returns A list of non-manager employees as merged teams.
	 */
	getNonManagerEmployees(project: IOrganizationProject): IEmployee[][] {
		return [
			project.members
				.filter((member: IOrganizationProjectEmployee) => !member.isManager)
				.map((member: IOrganizationProjectEmployee) => member.employee)
		];
	}

	/**
	 * Checks if the current data layout style is grid card layout.
	 * @returns `true` if the layout is grid card, `false` otherwise.
	 */
	private get _isGridCardLayout(): boolean {
		return this.dataLayoutStyle === this.componentLayoutStyleEnum.CARDS_GRID;
	}

	/**
	 * Loads and initializes the list of organization projects.
	 */
	async loadProjects(): Promise<void> {
		try {
			if (!this.organization) {
				return;
			}

			const { activePage, itemsPerPage } = this.getPagination();

			this.setSmartTableSource();
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);
			await this.loadGridLayoutData();
			this.loading = false;
		} catch (error) {
			console.error('Error loading organization projects:', error);
			this.loading = false;
		}
	}

	/**
	 * Loads grid layout data for organization projects.
	 */
	private async loadGridLayoutData() {
		if (this._isGridCardLayout) {
			await this.smartTableSource.getElements();
		}
	}

	/**
	 * Maps an organization project based on user permissions and project visibility.
	 *
	 * @param project The project to be mapped.
	 * @returns The mapped project.
	 */
	private privatePublicProjectMapper(project: IOrganizationProject): IOrganizationProject {
		const hasAccessToPrivateProjects = this._store.hasPermission(PermissionsEnum.ACCESS_PRIVATE_PROJECTS);

		if (hasAccessToPrivateProjects) {
			return project;
		} else {
			return project.public ? project : this.filterProjectMembers(project);
		}
	}

	/**
	 * Filters project members to include only the ones that match the current user's ID.
	 *
	 * @param project The project with members.
	 * @returns The project with filtered members.
	 */
	private filterProjectMembers(project: IOrganizationProject): IOrganizationProject {
		project.members = project.members.filter(
			(member: IOrganizationProjectEmployee) => member.employeeId === this._store.user?.employeeId
		);
		return project;
	}

	/**
	 * Load and configure the settings for the Smart Table component.
	 */
	private _loadSmartTableSettings(): void {
		const pagination = this.getPagination();
		this.settingsSmartTable = {
			actions: false,
			selectedRowIndex: -1,
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.PROJECT'),
			pager: {
				display: false,
				perPage: pagination ? this.pagination.itemsPerPage : this.minItemPerPage
			},
			columns: { ...this.columnsSmartTableMapper() }
		};
	}

	/**
	 * Map and configure the columns for the Smart Table component based on the data layout style.
	 * @returns The configured columns for the Smart Table.
	 */
	private columnsSmartTableMapper(): any {
		let columns: any;

		switch (this.dataLayoutStyle) {
			case this.componentLayoutStyleEnum.TABLE:
				columns = {
					project: {
						title: this.getTranslation('ORGANIZATIONS_PAGE.NAME'),
						type: 'custom',
						renderComponent: ProjectOrganizationComponent,
						componentInitFunction: (instance: ProjectOrganizationComponent, cell: Cell) => {
							instance.rowData = cell.getRow().getData();
							instance.value = cell.getValue();
						}
					},
					public: {
						title: this.getTranslation('ORGANIZATIONS_PAGE.EDIT.VISIBILITY'),
						type: 'custom',
						isFilterable: false,
						renderComponent: VisibilityComponent,
						componentInitFunction: (instance: VisibilityComponent, cell: Cell) => {
							instance.rowData = cell.getRow().getData();
							instance.value = cell.getValue();

							instance.visibilityChange.subscribe({
								next: (visibility: boolean) => {
									this.updateProjectVisibility(instance.rowData.id, visibility);
								},
								error: (err: any) => {
									console.warn(err);
								}
							});
						}
					},
					organizationContact: {
						title: this.getTranslation('ORGANIZATIONS_PAGE.EDIT.CONTACT'),
						type: 'custom',
						class: 'text-center',
						renderComponent: ContactLinksComponent,
						componentInitFunction: (instance: ContactLinksComponent, cell: Cell) => {
							instance.rowData = cell.getRow().getData();
							instance.value = cell.getRawValue();
						}
					},
					startDate: {
						title: this.getTranslation('ORGANIZATIONS_PAGE.EDIT.START_DATE'),
						type: 'custom',
						class: 'text-center',
						isFilterable: false,
						renderComponent: DateViewComponent,
						componentInitFunction: (instance: DateViewComponent, cell: Cell) => {
							instance.value = cell.getValue();
						}
					},
					endDate: {
						title: this.getTranslation('ORGANIZATIONS_PAGE.EDIT.END_DATE'),
						type: 'custom',
						class: 'text-center',
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
						componentInitFunction: (instance: EmployeeWithLinksComponent, cell: Cell) => {
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
					},
					tags: {
						title: this.getTranslation('SM_TABLE.TAGS'),
						type: 'custom',
						width: '10%',
						renderComponent: TagsOnlyComponent,
						componentInitFunction: (instance: TagsOnlyComponent, cell: Cell) => {
							instance.rowData = cell.getRow().getData();
							instance.value = cell.getValue();
						},
						filter: {
							type: 'custom',
							component: TagsColorFilterComponent
						},
						filterFunction: (tags: ITag[]) => {
							const tagIds = [];
							for (const tag of tags) {
								tagIds.push(tag.id);
							}
							this.setFilter({ field: 'tags', search: tagIds });
						},
						isSortable: false
					}
				};
				break;
			case this.componentLayoutStyleEnum.CARDS_GRID:
				columns = {
					project: {
						title: 'Image',
						type: 'custom',
						renderComponent: ProjectOrganizationGridComponent,
						componentInitFunction: (instance: ProjectOrganizationGridComponent, cell: Cell) => {
							instance.rowData = cell.getRow().getData();
							instance.value = cell.getValue();
						}
					},
					organizationContact: {
						title: 'Image',
						type: 'custom',
						class: 'text-center',
						renderComponent: ProjectOrganizationGridDetailsComponent,
						componentInitFunction: (instance: ProjectOrganizationGridDetailsComponent, cell: Cell) => {
							instance.rowData = cell.getRow().getData();
							instance.value = cell.getValue();
						}
					},
					employeesMergedTeams: {
						title: 'Image',
						type: 'custom',
						renderComponent: ProjectOrganizationEmployeesComponent,
						componentInitFunction: (instance: ProjectOrganizationEmployeesComponent, cell: Cell) => {
							instance.rowData = cell.getRow().getData();
							instance.value = cell.getValue();
						}
					}
				};
				break;
			default:
				console.log('Problem with a Layout view');
				break;
		}
		return columns;
	}

	/**
	 * Handles the selection of a project.
	 * @param isSelected Indicates whether the project is selected.
	 * @param data The selected project data.
	 */
	async selectProject({ isSelected, data }): Promise<void> {
		try {
			this.disableButton = !isSelected;
			this.selectedProject = isSelected ? data : null;

			if (isSelected && this.selectedProject) {
				// Check if the user is manager of the selected project
				const isManager = this.isManagerOfProject(this.selectedProject);

				// Check if the user has all the required permissions
				const hasAllPermissions = this.hasAllPermissions([
					PermissionsEnum.ALL_ORG_EDIT,
					PermissionsEnum.ORG_PROJECT_EDIT,
					PermissionsEnum.ORG_PROJECT_DELETE
				]);

				// Dynamically assign the CAN_MANAGE_PROJECT permission if either condition is true
				if (isManager || hasAllPermissions) {
					this._permissionsService.addPermission('CAN_MANAGE_PROJECT');
				} else {
					this._permissionsService.removePermission('CAN_MANAGE_PROJECT');
				}
			}
			if (this._isGridCardLayout && this._grid) {
				if (this._grid.customComponentInstance().constructor === ProjectOrganizationGridComponent) {
					this.disableButton = true;
					const projectOrganizationGrid: ProjectOrganizationGridComponent =
						this._grid.customComponentInstance<ProjectOrganizationGridComponent>();
					await this.updateProjectVisibility(data.id, !projectOrganizationGrid.visibility);
				}
			}
		} catch (error) {
			console.error('Error selecting project:', error);
		}
	}

	/**
	 * Apply translation changes to the Smart Table settings.
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
	 * Update the visibility of a project.
	 * @param projectId The ID of the project to update.
	 * @param visibility The new visibility status (true for public, false for private).
	 */
	private async updateProjectVisibility(projectId: string, visibility: boolean) {
		try {
			await this._organizationProjectsService.edit({
				public: visibility,
				id: projectId
			});
			const successMessage = visibility
				? this.getTranslation('BUTTONS.PRIVATE')
				: this.getTranslation('BUTTONS.PUBLIC');

			this._toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_PROJECTS.VISIBILITY', {
				name: successMessage
			});
		} catch (error) {
			console.error('Error while updating project visibility', error?.message);
			this._errorHandlingService.handleError(error);
		}
	}

	hasAllPermissions(permissions: PermissionsEnum[]): boolean {
		return permissions.every((permission) => this._permissionsService.getPermission(permission));
	}

	/**
	 * Clear the selected item and deselect all table rows.
	 */
	clearItem(): void {
		this.selectProject({
			isSelected: false,
			data: null
		});
	}

	/**
	 * Navigates to the create or edit project page based on the provided project.
	 * If no project is provided, it navigates to the create page.
	 *
	 * @param project - (Optional) The project to edit. If not provided, navigates to the create page.
	 */
	navigateToProject(project?: IOrganizationProject): void {
		// Define the base path for the project page
		const basePath = '/pages/organization/projects';
		// Construct the path based on the provided project
		const path = project ? [basePath, project.id, 'edit'] : [basePath, 'create'];
		// Navigate to the specified path
		this._router.navigate(path);
	}

	/**
	 * Opens a dialog for creating a new project module
	 * @param project The project for which to create a module
	 * @returns Promise that resolves when the dialog is closed
	 */
	public async createProjectModuleDialog(project: IOrganizationProject): Promise<void> {
		try {
			const result = await firstValueFrom(
				this._dialogService.open(ProjectModuleMutationComponent, {
					context: {
						project,
						createModule: true
					}
				}).onClose
			);

			if (result) {
				// Refresh the project list or handle the result as needed
				this._refresh$.next(true);
				this.project$.next(true);
			}
		} catch (error) {
			console.error('Error while creating project module', error?.message);
			this._errorHandlingService.handleError(error);
		}
	}
}
