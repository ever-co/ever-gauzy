import { AfterViewInit, Component, OnInit, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Data, Router } from '@angular/router';
import { BehaviorSubject, EMPTY, Subject, debounceTime, finalize, of } from 'rxjs';
import { Observable } from 'rxjs/internal/Observable';
import { catchError, filter, map, mergeMap, switchMap, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { NbPopoverDirective, NbTabComponent } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Angular2SmartTableComponent, Cell } from 'angular2-smart-table';
import {
	GithubRepositoryStatusEnum,
	HttpStatus,
	IGithubIssue,
	IGithubRepository,
	IIntegrationMapSyncRepository,
	IIntegrationTenant,
	IOrganization,
	IOrganizationGithubRepository,
	IOrganizationProject,
	IUser,
	SYNC_TAG_GAUZY,
	TaskStatusEnum
} from '@gauzy/contracts';
import { ErrorHandlingService, GithubService, OrganizationProjectsService, ToastrService } from '@gauzy/ui-core/core';
import { Store, distinctUntilChange } from '@gauzy/ui-core/common';
import {
	ClickableLinkComponent,
	ProjectComponent,
	GithubRepositoryComponent,
	GithubIssueTitleDescriptionComponent,
	ToggleSwitchComponent,
	ResyncButtonComponent,
	PaginationFilterBaseComponent,
	IPaginationBase,
	HashNumberPipe,
	StatusBadgeComponent
} from '@gauzy/ui-core/shared';

export enum SyncTabsEnum {
	AUTO_SYNC = 'AUTO_SYNC',
	MANUAL_SYNC = 'MANUAL_SYNC'
}

@UntilDestroy({ checkProperties: true })
@Component({
	styleUrls: ['./view.component.scss'],
	templateUrl: './view.component.html',
	providers: [TitleCasePipe]
})
export class GithubViewComponent extends PaginationFilterBaseComponent implements AfterViewInit, OnInit {
	public syncTabsEnum: typeof SyncTabsEnum = SyncTabsEnum;
	public nbTab$: Subject<string> = new BehaviorSubject(SyncTabsEnum.AUTO_SYNC);
	public page$: Observable<IPaginationBase>; // Observable for the organization project
	public settingsSmartTableIssues: object; // Settings for the Smart Table used for issues
	public settingsSmartTableProjects: object; // Settings for the Smart Table used for projects
	public syncing: boolean = false; // Flag to indicate if data synchronization is in progress
	public loading: boolean = false; // Flag to indicate if data loading is in progress
	public user: IUser = this._store.user; // User object obtained from a service (likely a store)
	public organization: IOrganization = this._store.selectedOrganization; // Selected organization object
	public repository: IGithubRepository; // GitHub repository object
	public project: IOrganizationProject; // Organization project object
	public project$: Observable<IOrganizationProject>; // Observable for the organization project
	public projects: IOrganizationProject[] = []; // Array of organization projects
	public projects$: Observable<IOrganizationProject[]>; // Observable for an array of organization projects
	public integration: IIntegrationTenant; // Integration object
	public integration$: Observable<IIntegrationTenant>; // Observable for the integration
	public issues$: Observable<IGithubIssue[]>; // Observable for an array of GitHub issues
	public issues: IGithubIssue[] = []; // Array of GitHub issues
	public selectedIssues: IGithubIssue[] = []; // Array of selected GitHub issues
	public selectedProject$: Subject<IOrganizationProject> = new Subject(); // Subject for selected organization projects
	public subject$: BehaviorSubject<boolean> = new BehaviorSubject(true);
	/**
	 * Sets up a property 'issuesTable' to reference an instance of 'Angular2SmartTableComponent'
	 * when the child component with the template reference variable 'issuesTable' is rendered.
	 * This allows interaction with the child component from the parent component.
	 */
	private _issuesTable: Angular2SmartTableComponent;
	@ViewChild('issuesTable') set content(content: Angular2SmartTableComponent) {
		if (content) {
			this._issuesTable = content;
		}
	}

	@ViewChildren(NbPopoverDirective) public popups: QueryList<NbPopoverDirective>;

	constructor(
		private readonly _router: Router,
		public readonly _translateService: TranslateService,
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _titlecasePipe: TitleCasePipe,
		private readonly _hashNumberPipe: HashNumberPipe,
		private readonly _toastrService: ToastrService,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly _store: Store,
		private readonly _githubService: GithubService,
		private readonly _organizationProjectsService: OrganizationProjectsService
	) {
		super(_translateService);
	}

	ngOnInit(): void {
		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();
		this._getIntegrationTenant();
		this._getIntegrationProjects();
	}

	ngAfterViewInit(): void {
		this.project$ = this.selectedProject$.pipe(
			debounceTime(100),
			distinctUntilChange(),
			tap((project: IOrganizationProject) => (this.project = project || null)),
			filter(() => !!this.project),
			switchMap(() => {
				// Extract project properties
				const { id: projectId } = this.project;
				// Ensure there is a valid organization
				if (!projectId) {
					return EMPTY; // No valid organization, return false
				}
				return this._organizationProjectsService.getById(projectId, ['customFields.repository']).pipe(
					catchError((error) => {
						// Handle and log errors
						this._errorHandlingService.handleError(error);
						return EMPTY;
					}),
					// Handle component lifecycle to avoid memory leaks
					untilDestroyed(this)
				);
			})
		);
	}

	/**
	 * Fetches and sets the GitHub integration data from the ActivatedRoute data.
	 */
	private _getIntegrationTenant() {
		this.integration$ = this._activatedRoute.parent.data.pipe(
			// Extract the 'integration' from the data
			map(({ integration }: Data) => integration),
			// Store the integration in the 'integration' property
			tap((integration: IIntegrationTenant) => (this.integration = integration)),
			// Automatically unsubscribe when the component is destroyed
			untilDestroyed(this)
		);
	}

	/**
	 * Fetches and sets the GitHub integration projects from the ActivatedRoute data.
	 */
	private _getIntegrationProjects(): void {
		this.projects$ = this.subject$.pipe(
			filter(() => !!this.organization),
			switchMap(() => {
				// Extract project properties
				const { id: organizationId, tenantId } = this.organization;
				// Ensure there is a valid organization
				if (!organizationId) {
					return of([]); // No valid organization, return false
				}
				return this._organizationProjectsService.findSyncedProjects({ organizationId, tenantId }).pipe(
					map(({ items }) => items),
					catchError((error) => {
						// Handle and log errors
						this._errorHandlingService.handleError(error);
						return EMPTY;
					}),
					// Handle component lifecycle to avoid memory leaks
					untilDestroyed(this)
				);
			})
		);
	}

	/**
	 * Selects a GitHub repository.
	 *
	 * @param repository The GitHub repository to select.
	 */
	public selectAutoRepository(repository: IGithubRepository) {
		// Set the 'repository' property to the provided 'repository' object.
		this.repository = repository;
	}

	/**
	 * Select a GitHub repository manually and fetch its issues.
	 *
	 * @param repository The GitHub repository to select.
	 */
	public selectManualRepository(repository: IGithubRepository): void {
		// Set the 'repository' property to the provided 'repository' object.
		this.repository = repository;

		// Initialize the 'selectedIssues' property with an empty array.
		this.selectedIssues = [];

		// Refresh the pagination settings or configuration.
		this.refreshPagination();

		// Create an Observable `page$` by piping the `pagination$` Observable through a series of operators.
		this.page$ = this.pagination$.pipe(
			// Add a 100ms delay to the emitted values.
			debounceTime(100),
			// Ensure only distinct values are emitted.
			distinctUntilChange(),
			// Fetch and assign issues using 'getRepositoryIssue'.
			tap(() => this.getRepositoryIssue()),
			// Manage the component's lifecycle to avoid memory leaks.
			untilDestroyed(this)
		);
	}

	/**
	 * Fetches issues for a given repository.
	 *
	 * @param repository
	 * @returns
	 */
	private getRepositoryIssue(): Observable<IGithubIssue[]> {
		// Ensure there is a valid organization
		if (!this.organization || !this.repository) {
			return of([]); // Return an empty observable if there is no organization
		}

		const repository = this.repository;
		const owner = repository.owner['login'];
		const repo = repository.name;

		// Extract organization properties
		const { id: organizationId, tenantId } = this.organization;

		this.issues$ = this._activatedRoute.parent.data.pipe(
			filter(({ integration }: Data) => !!integration),
			switchMap(() => this._activatedRoute.params.pipe(filter(({ integrationId }) => integrationId))),
			tap(() => (this.loading = true)),
			// Get the 'integrationId' route parameter
			switchMap(({ integrationId }) => {
				/**
				 * Applied smart table pagination configuration
				 */
				const { activePage, itemsPerPage } = this.getPagination();
				return this._githubService.getRepositoryIssues(integrationId, owner, repo, {
					organizationId,
					tenantId,
					per_page: itemsPerPage,
					page: activePage
				});
			}),
			// Update component state with fetched issues
			tap((issues: IGithubIssue[]) => {
				this.issues = issues;
			}),
			tap(() => {
				this.setPagination({
					...this.getPagination(),
					totalItems: repository.open_issues_count
				});
			}),
			catchError((error) => {
				// Handle and log errors
				this._errorHandlingService.handleError(error);
				return of([]);
			}),
			tap(() => (this.loading = false)),
			// Handle component lifecycle to avoid memory leaks
			untilDestroyed(this)
		);
		this.issues$.subscribe();
	}

	/**
	 * Apply translations to a Smart Table component when the language changes.
	 */
	private _applyTranslationOnSmartTable() {
		// Listen for language changes using the 'translateService.onLangChange' observable
		this.translateService.onLangChange
			.pipe(
				// When the language changes, load Smart Table settings
				tap(() => this._loadSmartTableSettings()),

				// Handle component lifecycle to avoid memory leaks
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Load Smart Table settings to configure the component.
	 */
	private _loadSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();

		// Define settings for the Smart Table
		this.settingsSmartTableIssues = {
			selectedRowIndex: -1, // Initialize the selected row index
			selectMode: 'multi', // Set select mode to 'multi' for multiple row selection
			actions: {
				add: false, // Disable 'add' action
				edit: false, // Disable 'edit' action
				delete: false, // Disable 'delete' action
				select: true // Enable 'select' action
			},
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : 10
			},
			columns: {
				number: {
					title: this.getTranslation('SM_TABLE.NUMBER'), // Set column title based on translation
					width: '10%',
					type: 'custom', // Set column type to 'custom'
					renderComponent: ClickableLinkComponent,
					componentInitFunction: (instance: ClickableLinkComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
						instance.href = 'html_url';
					},
					valuePrepareFunction: (number: IGithubIssue['number']) => {
						return this._hashNumberPipe.transform(number);
					}
				},
				body: {
					title: this.getTranslation('SM_TABLE.DESCRIPTION'), // Set column title based on translation
					width: '80%',
					type: 'custom', // Set column type to 'custom'
					renderComponent: GithubIssueTitleDescriptionComponent,
					componentInitFunction: (instance: ClickableLinkComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
					}
				},
				state: {
					title: this.getTranslation('SM_TABLE.STATUS'), // Set column title based on translation
					width: '10%',
					type: 'custom', // Set column type to 'custom'
					renderComponent: StatusBadgeComponent,
					componentInitFunction: (instance: StatusBadgeComponent, cell: Cell) => {
						instance.value = cell.getValue();
					},
					valuePrepareFunction: (value: TaskStatusEnum) => this.getIssueStatus(value)
				}
			}
		};

		// Define settings for the Smart Table
		this.settingsSmartTableProjects = {
			selectedRowIndex: -1, // Initialize the selected row index
			hideSubHeader: true,
			actions: false,
			mode: 'external',
			editable: true,
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : 10
			},
			columns: {
				repository: {
					title: this.getTranslation('SM_TABLE.GITHUB_REPOSITORY'), // Set column title based on translation
					type: 'custom',
					filter: false,
					renderComponent: GithubRepositoryComponent,
					componentInitFunction: (instance: GithubRepositoryComponent, cell: Cell) => {
						// Set properties on the ProjectComponent instance
						instance.rowData = cell.getRow().getData();
						// Set properties on the GithubRepositoryComponent instance
						instance.value = cell.getRawValue();
					}
				},
				project: {
					title: this.getTranslation('SM_TABLE.PROJECT'), // Set column title based on translation
					type: 'custom',
					filter: false,
					renderComponent: ProjectComponent,
					valuePrepareFunction: (_: any, cell: Cell) => ({
						project: cell.getRow().getData()
					}),
					componentInitFunction: (instance: ProjectComponent, cell: Cell) => {
						// Set properties on the ProjectComponent instance
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					}
				},
				issuesCount: {
					title: this.getTranslation('SM_TABLE.ISSUES_SYNC'), // Set column title based on translation
					type: 'number',
					filter: false,
					valuePrepareFunction: (_: any, cell: Cell) => {
						// Get the data of the entire row
						const row = cell.getRow().getData();
						const count = row.customFields.repository.issuesCount; // Get repository synced issues count
						// Prepare the value for the cell by using translation and the 'issuesCount' property from the row
						return this.getTranslation('SM_TABLE.ISSUES_SYNC_COUNT', { count });
					}
				},
				hasSyncEnabled: {
					title: this.getTranslation('SM_TABLE.ENABLED_DISABLED_SYNC'),
					type: 'custom',
					filter: false,
					renderComponent: ToggleSwitchComponent,
					componentInitFunction: (instance: ToggleSwitchComponent, cell: Cell) => {
						// Get the data of the entire row
						const rowData = cell.getRow().getData();

						// Set properties on the ToggleSwitchComponent instance
						instance.rowData = rowData;
						instance.value = rowData?.customFields?.repository?.hasSyncEnabled || false;

						// Subscribe to the 'switched' event of the ToggleSwitchComponent
						instance.switched.subscribe({
							// When the switch state changes, execute the following callback
							next: (hasSyncEnabled: boolean) => {
								// Call the 'updateGithubRepository' method with the row data and the new switch state
								this.updateGithubRepository(rowData, hasSyncEnabled);
							},
							// If there is an error, log a warning
							error: (error: any) => {
								// Handle and log errors using an error handling service
								this._errorHandlingService.handleError(error);
							}
						});
					}
				},
				resync: {
					title: this.getTranslation('SM_TABLE.RESYNC_ISSUES'),
					type: 'custom',
					filter: false,
					renderComponent: ResyncButtonComponent,
					componentInitFunction: (instance: ResyncButtonComponent, cell: Cell) => {
						// Get the data of the entire row
						const rowData = cell.getRow().getData();

						// Set properties on the ResyncButtonComponent instance
						instance.rowData = rowData;

						// Subscribe to the 'clicked' event of the ResyncButtonComponent
						instance.clicked.subscribe({
							// When the button is clicked, execute the following callback
							next: () => {
								// Call the 'resyncIssues' method with the rowData as an argument
								this.resyncIssues(instance.rowData);
							},
							// Handle errors if they occur during the subscription
							error: (error: any) => {
								// Handle and log errors using an error handling service
								this._errorHandlingService.handleError(error);
							}
						});
					}
				},
				status: {
					title: this.getTranslation('SM_TABLE.STATUS'), // Set column title based on translation
					type: 'custom',
					filter: false,
					renderComponent: StatusBadgeComponent,
					componentInitFunction: (instance: StatusBadgeComponent, cell: Cell) => {
						// Get the data of the entire row
						const row = cell.getRow().getData();
						const repository: IOrganizationGithubRepository = row.customFields.repository;

						// Transform the column data using 'this.statusMapper'
						instance.value = this.statusMapper(repository);
					}
				}
			}
		};
	}

	/**
	 * Update a GitHub repository within the context of an organization project and handle various operations.
	 * @param project - An object representing the organization project.
	 * @param hasSyncEnabled - A boolean indicating whether sync is enabled.
	 */
	private updateGithubRepository(project: IOrganizationProject, hasSyncEnabled: boolean) {
		const repository = project.customFields['repository'];
		if (!repository) {
			return;
		}

		const { organizationId, tenantId } = project;

		// Update a GitHub repository using the _githubService and handle various operations.
		this._githubService
			.updateGithubRepository(repository.id, {
				hasSyncEnabled,
				tenantId,
				organizationId
			})
			.pipe(
				// Perform side effects
				tap(() => {
					// Determine the success message based on whether hasSyncEnabled is true or false
					const message = hasSyncEnabled
						? 'INTEGRATIONS.GITHUB_PAGE.HAS_SYNCED_ENABLED'
						: 'INTEGRATIONS.GITHUB_PAGE.HAS_SYNCED_DISABLED';

					// Display a success toast message using the _toastrService
					this._toastrService.success(
						this.getTranslation(message, { repository: repository.fullName }),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
				}),
				// Update the subject with a value of true
				tap(() => this.subject$.next(true)),
				// Catch and handle errors
				catchError((error) => {
					// Handle and log errors using the _errorHandlingService
					this._errorHandlingService.handleError(error);
					// Return an empty observable to continue the stream
					return EMPTY;
				}),
				// Handle component lifecycle to avoid memory leaks
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Opens a modal popover for integration settings if the 'integration' object is defined.
	 */
	openSettingModalPopover() {
		// Check if the 'integration' object is falsy and return early if it is
		if (!this.integration) {
			return;
		}

		// Open the modal popover (assuming `popups` is an array or collection of popovers)
		this.popups.first.toggle();
	}

	/**
	 * Updates the selected issues based on the user's selection.
	 * @param selected - An array of selected issues.
	 */
	selectIssues({ selected }: { selected: any[] }): void {
		this.selectedIssues = selected;
	}

	/**
	 *
	 */
	onChangeTab(tab: NbTabComponent) {
		this.nbTab$.next(tab.tabId);
	}

	/**
	 * Check if there is a valid organization, repository, and project.
	 * If valid, log the organization, repository, and project to the console.
	 */
	autoSyncIssues(): void {
		try {
			// Ensure there is a valid organization, repository, and project
			if (!this.organization || !this.repository || !this.project) {
				return;
			}

			// Avoid running another synchronization if one is already in progress
			if (this.syncing) {
				return;
			}

			// Mark the synchronization as in progress
			this.syncing = this.loading = true;

			const { id: organizationId, tenantId } = this.organization;
			const { id: integrationId } = this.integration;
			const { id: projectId } = this.project;

			// Create a request object for syncing the GitHub repository
			const repositorySyncRequest: IIntegrationMapSyncRepository = {
				organizationId,
				tenantId,
				integrationId,
				repository: this.repository
			};

			let repository: IOrganizationGithubRepository;

			// Synchronize the GitHub repository and update project settings
			this._githubService
				.syncGithubRepository(repositorySyncRequest)
				.pipe(
					tap((item: IOrganizationGithubRepository) => {
						repository = item;
					}),
					mergeMap(({ id: repositoryId }: IOrganizationGithubRepository) => {
						const setting$ = this._organizationProjectsService.updateProjectSetting(projectId, {
							organizationId,
							tenantId,
							customFields: { repositoryId },
							syncTag: SYNC_TAG_GAUZY
						});
						const issues$ = this._githubService.autoSyncIssues(integrationId, repository, {
							projectId,
							organizationId,
							tenantId
						});
						return setting$.pipe(
							mergeMap(() => issues$),
							tap((process: boolean) => {
								if (process) {
									this._toastrService.success(
										this.getTranslation('INTEGRATIONS.GITHUB_PAGE.SYNCED_ISSUES', {
											repository: this.repository.full_name
										}),
										this.getTranslation('TOASTR.TITLE.SUCCESS')
									);
								}
								this.subject$.next(true);
							})
						);
					}),
					catchError((error) => {
						this._errorHandlingService.handleError(error);
						return EMPTY;
					}),
					// Execute the following code block when the observable completes or errors
					finalize(() => {
						this.syncing = this.loading = false;
					}),
					// Automatically unsubscribe when the component is destroyed
					untilDestroyed(this)
				)
				.subscribe();
		} catch (error) {
			// Handle errors (e.g., display an error message or log the error)
			console.error('Error while syncing GitHub issues automatically:', error.message);

			// Optionally, you can provide error feedback to the user
			this._errorHandlingService.handleError(error);
		}
	}

	/**
	 * Initiates a manual synchronization process for GitHub issues.
	 *
	 * @returns
	 */
	manualSyncIssues(): void {
		try {
			// Ensure there is a valid organization, repository, and project
			if (!this.organization || !this.repository || !this.project) {
				return;
			}

			// Avoid running another synchronization if one is already in progress
			if (this.syncing) {
				return;
			}

			// Mark the synchronization as in progress
			this.syncing = this.loading = true;

			const { id: organizationId, tenantId } = this.organization;
			const { id: integrationId } = this.integration;
			const { id: projectId } = this.project;

			// Create a request object for syncing the GitHub repository
			const repositorySyncRequest: IIntegrationMapSyncRepository = {
				organizationId,
				tenantId,
				integrationId,
				repository: this.repository
			};

			let repository: IOrganizationGithubRepository;

			// Synchronize the GitHub repository and update project settings
			this._githubService
				.syncGithubRepository(repositorySyncRequest)
				.pipe(
					tap((item: IOrganizationGithubRepository) => (repository = item)),
					mergeMap(({ id: repositoryId }: IOrganizationGithubRepository) =>
						this._organizationProjectsService.updateProjectSetting(projectId, {
							organizationId,
							tenantId,
							customFields: { repositoryId },
							syncTag: SYNC_TAG_GAUZY
						})
					),
					mergeMap(() =>
						this._githubService.manualSyncIssues(integrationId, repository, {
							projectId,
							organizationId,
							tenantId,
							issues: this.selectedIssues
						})
					),
					tap((response: any) => {
						if (response['status'] == HttpStatus.BAD_REQUEST) {
							throw new Error(`${response['message']}`);
						}
					}),
					tap((process: boolean) => {
						if (process) {
							this._toastrService.success(
								this.getTranslation('INTEGRATIONS.GITHUB_PAGE.SYNCED_ISSUES', {
									repository: this.repository.full_name
								}),
								this.getTranslation('TOASTR.TITLE.SUCCESS')
							);
						}
						this.resetTableSelectedItems();
						this.getRepositoryIssue();
					}),
					catchError((error) => {
						// Handle and log errors
						console.error('Error while syncing GitHub issues & labels manually:', error.message);
						this._errorHandlingService.handleError(error);
						return EMPTY;
					}),
					// Execute the following code block when the observable completes or errors
					finalize(() => (this.syncing = this.loading = false)),
					// Automatically unsubscribe when the component is destroyed
					untilDestroyed(this)
				)
				.subscribe();
		} catch (error) {
			// Handle errors (e.g., display an error message or log the error)
			console.error('Error while syncing GitHub issues & labels manually:', error.message);

			// Optionally, you can provide error feedback to the user
			this._errorHandlingService.handleError(error);
		}
	}

	/**
	 *
	 * @param project
	 */
	resyncIssues(project: IOrganizationProject) {
		try {
			// Ensure there is a valid organization, and project
			if (!this.organization || !project || !project?.customFields?.repository) {
				return;
			}

			this.loading = true;

			this.project = project;
			const { repository } = project.customFields;

			const { id: organizationId, tenantId } = this.organization;
			const { id: integrationId } = this.integration;
			const { id: projectId } = this.project;

			this._githubService
				.autoSyncIssues(integrationId, repository, {
					projectId,
					organizationId,
					tenantId
				})
				.pipe(
					tap((process: boolean) => {
						if (process) {
							this._toastrService.success(
								this.getTranslation('INTEGRATIONS.GITHUB_PAGE.SYNCED_ISSUES', {
									repository: repository.fullName
								}),
								this.getTranslation('TOASTR.TITLE.SUCCESS')
							);
						}
						this.subject$.next(true);
					}),
					catchError((error) => {
						this._errorHandlingService.handleError(error);
						return EMPTY;
					}),
					// Execute the following code block when the observable completes or errors
					finalize(() => {
						this.loading = false;
					}),
					// Automatically unsubscribe when the component is destroyed
					untilDestroyed(this)
				)
				.subscribe();
		} catch (error) {
			// Handle errors (e.g., display an error message or log the error)
			console.log('Error while resyncing issues from repository:', error.message);

			// Optionally, you can provide error feedback to the user
			this._errorHandlingService.handleError(error);
		}
	}

	/**
	 * Clears selected items in the table component and resets the 'selectedIssues' array.
	 */
	resetTableSelectedItems() {
		if (this._issuesTable && this._issuesTable.grid) {
			// Deselect all items in the table
			this._issuesTable.grid.dataSet.deselectAll();

			// Clear the 'selectedIssues' array
			this.selectedIssues = [];
		}
	}

	/**
	 * Map the status of a GitHub repository to an object with text, value, and class properties.
	 * @param row - An object representing the GitHub repository.
	 * @returns An object with text, value, and class properties that describe the status.
	 */
	statusMapper(row: IOrganizationGithubRepository): { text: string; value: string; class: string } {
		// If sync is not enabled, return a warning status
		if (!row.hasSyncEnabled) {
			return {
				text: this._titlecasePipe.transform(GithubRepositoryStatusEnum.DISABLED),
				value: GithubRepositoryStatusEnum.DISABLED,
				class: 'warning'
			};
		}

		// Map status to badgeClass based on the status value
		let badgeClass: string;
		let value: string = row.status;

		switch (row.status) {
			case GithubRepositoryStatusEnum.SYNCING:
				badgeClass = 'info';
				break;
			case GithubRepositoryStatusEnum.SUCCESSFULLY:
				badgeClass = 'success';
				break;
			case GithubRepositoryStatusEnum.ERROR:
				badgeClass = 'danger';
				break;
			default:
				badgeClass = 'warning';
				break;
		}

		// Return an object with the mapped status information
		return {
			text: this._titlecasePipe.transform(value),
			value: value,
			class: badgeClass
		};
	}

	/**
	 * Get job status text and class
	 *
	 * @param status
	 */
	getIssueStatus(state: TaskStatusEnum) {
		let badgeClass: string, badgeText: string;
		switch (state.toLowerCase()) {
			case TaskStatusEnum.OPEN.toLowerCase():
				badgeClass = 'success';
				badgeText = this._titlecasePipe.transform(state);
				break;
			default:
				badgeClass = 'default';
				badgeText = state;
				break;
		}
		return {
			text: badgeText,
			class: badgeClass
		};
	}

	/**
	 * Navigate to the "Integrations" page.
	 */
	navigateToIntegrations(): void {
		this._router.navigate(['/pages/integrations']);
	}

	/**
	 * Navigates to the 'Reset Integration' route within the GitHub integration setup wizard.
	 */
	navigateToResetIntegration(): void {
		this._router.navigate(['/pages/integrations/github/setup/wizard/reset']);
	}
}
