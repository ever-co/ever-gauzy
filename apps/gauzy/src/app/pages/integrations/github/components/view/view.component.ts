import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Data, Router } from '@angular/router';
import { BehaviorSubject, EMPTY, Subject, debounceTime, finalize, first, firstValueFrom, of } from 'rxjs';
import { Observable } from 'rxjs/internal/Observable';
import { catchError, filter, map, switchMap, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Ng2SmartTableComponent } from 'ng2-smart-table';
import {
	GithubRepositoryStatusEnum,
	HttpStatus,
	IEntitySettingToSync,
	IGithubIssue,
	IGithubRepository,
	IIntegrationMapSyncRepository,
	IIntegrationTenant,
	IOrganization,
	IOrganizationGithubRepository,
	IOrganizationProject,
	IUser,
	IntegrationEnum,
	SYNC_TAG_GAUZY,
	TaskStatusEnum
} from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/common-angular';
import {
	ErrorHandlingService,
	GithubService,
	IntegrationEntitySettingService,
	IntegrationEntitySettingServiceStoreService,
	OrganizationProjectsService,
	Store,
	ToastrService
} from './../../../../../@core/services';
import { IPaginationBase, PaginationFilterBaseComponent } from './../../../../../@shared/pagination/pagination-filter-base.component';
import { StatusBadgeComponent } from './../../../../../@shared/status-badge';
import { HashNumberPipe } from './../../../../../@shared/pipes';
import {
	ClickableLinkComponent,
	ProjectComponent,
	GithubRepositoryComponent,
	GithubAutoSyncSwitchComponent,
	GithubIssueTitleDescriptionComponent
} from './../../../../../@shared/table-components';
import { GithubSettingsDialogComponent } from '../settings-dialog/settings-dialog.component';

@UntilDestroy({ checkProperties: true })
@Component({
	styleUrls: ['./view.component.scss'],
	templateUrl: './view.component.html',
	providers: [TitleCasePipe]
})
export class GithubViewComponent extends PaginationFilterBaseComponent implements AfterViewInit, OnInit {

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
	 * Sets up a property 'issuesTable' to reference an instance of 'Ng2SmartTableComponent'
	 * when the child component with the template reference variable 'issuesTable' is rendered.
	 * This allows interaction with the child component from the parent component.
	 */
	private _issuesTable: Ng2SmartTableComponent;
	@ViewChild('issuesTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this._issuesTable = content;
		}
	}

	constructor(
		private readonly _router: Router,
		public readonly _translateService: TranslateService,
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _titlecasePipe: TitleCasePipe,
		private readonly _hashNumberPipe: HashNumberPipe,
		private readonly _dialogService: NbDialogService,
		private readonly _toastrService: ToastrService,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly _store: Store,
		private readonly _githubService: GithubService,
		private readonly _integrationEntitySettingService: IntegrationEntitySettingService,
		private readonly _integrationEntitySettingServiceStoreService: IntegrationEntitySettingServiceStoreService,
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
			tap((project: IOrganizationProject) => this.project = project || null),
			filter(() => !!this.project),
			switchMap(() => {
				// Extract project properties
				const { id: projectId } = this.project;
				// Ensure there is a valid organization
				if (!projectId) {
					return EMPTY; // No valid organization, return false
				}
				return this._organizationProjectsService.getById(projectId, ['repository']).pipe(
					catchError((error) => {
						// Handle and log errors
						this._errorHandlingService.handleError(error);
						return EMPTY;
					}),
					// Handle component lifecycle to avoid memory leaks
					untilDestroyed(this),
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
			tap((integration: IIntegrationTenant) => this.integration = integration),
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
					untilDestroyed(this),
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
			switchMap(() => this._activatedRoute.params.pipe(
				filter(({ integrationId }) => integrationId)
			)),
			tap(() => this.loading = true),
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
			tap(() => this.loading = false),
			// Handle component lifecycle to avoid memory leaks
			untilDestroyed(this),
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
					width: '5%',
					type: 'custom', // Set column type to 'custom'
					renderComponent: ClickableLinkComponent,
					valuePrepareFunction: (number: IGithubIssue['number']) => {
						return this._hashNumberPipe.transform(number);
					},
					onComponentInitFunction: (instance: any) => {
						instance['href'] = 'html_url';
					}
				},
				body: {
					title: this.getTranslation('SM_TABLE.DESCRIPTION'), // Set column title based on translation
					width: '90%',
					type: 'custom', // Set column type to 'custom'
					renderComponent: GithubIssueTitleDescriptionComponent
				},
				state: {
					title: this.getTranslation('SM_TABLE.STATUS'), // Set column title based on translation
					width: '5%',
					type: 'custom', // Set column type to 'custom'
					renderComponent: StatusBadgeComponent,
					valuePrepareFunction: (state: TaskStatusEnum) => {
						return this.getIssueStatus(state);
					}
				},
			}
		};


		// Define settings for the Smart Table
		this.settingsSmartTableProjects = {
			selectedRowIndex: -1, // Initialize the selected row index
			actions: false,
			columns: {
				repository: {
					title: this.getTranslation('SM_TABLE.GITHUB_REPOSITORY'), // Set column title based on translation
					type: 'custom',
					renderComponent: GithubRepositoryComponent,
					filter: false
				},
				project: {
					title: this.getTranslation('SM_TABLE.PROJECT'), // Set column title based on translation
					type: 'custom',
					renderComponent: ProjectComponent,
					filter: false,
					valuePrepareFunction: (i: any, row: IOrganizationProject) => ({
						project: row
					})
				},
				issuesCount: {
					title: this.getTranslation('SM_TABLE.ISSUES_SYNC'), // Set column title based on translation
					type: 'number',
					filter: false,
					valuePrepareFunction: (i: any, row: IOrganizationProject) => {
						return this.getTranslation('SM_TABLE.ISSUES_SYNC_COUNT', {
							count: row?.repository?.issuesCount
						})
					}
				},
				hasSyncEnabled: {
					title: this.getTranslation('SM_TABLE.ENABLED_DISABLED_SYNC'),
					type: 'custom',
					filter: false,
					renderComponent: GithubAutoSyncSwitchComponent,
					valuePrepareFunction: (i: any, row: IOrganizationProject) => {
						return row?.repository?.hasSyncEnabled || false;
					},
					onComponentInitFunction: (instance: any) => {
						instance.autoSyncChange.subscribe({
							next: (hasSyncEnabled: boolean) => {
								this.updateGithubRepository(instance.rowData, hasSyncEnabled);
							},
							error: (err: any) => {
								console.warn(err);
							}
						});
					}
				},
				status: {
					title: this.getTranslation('SM_TABLE.STATUS'), // Set column title based on translation
					type: 'custom',
					renderComponent: StatusBadgeComponent,
					filter: false,
					valuePrepareFunction: (i: any, row: IOrganizationProject) => {
						// Transform the column data using '_titlecasePipe.transform' (modify this function)
						return this.statusMapper(row.repository);
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
		const repository = project['repository'];
		if (!repository) {
			return;
		}

		const { organizationId, tenantId } = project;

		// Update a GitHub repository using the _githubService and handle various operations.
		this._githubService.updateGithubRepository(repository.id, {
			hasSyncEnabled,
			tenantId,
			organizationId
		}).pipe(
			tap((response: any) => {
				if (response['status'] == HttpStatus.BAD_REQUEST) {
					throw new Error(`${response['message']}`);
				}
			}),
			// Catch and handle errors
			catchError((error) => {
				// Handle and log errors using the _errorHandlingService
				this._errorHandlingService.handleError(error);
				// Return an empty observable to continue the stream
				return EMPTY;
			}),
			// Perform side effects
			tap(() => {
				// Determine the success message based on whether hasSyncEnabled is true or false
				const message = hasSyncEnabled ? 'INTEGRATIONS.GITHUB_PAGE.HAS_SYNCED_ENABLED' : 'INTEGRATIONS.GITHUB_PAGE.HAS_SYNCED_DISABLED';

				// Display a success toast message using the _toastrService
				this._toastrService.success(
					this.getTranslation(message, { repository: repository.fullName }),
					this.getTranslation('TOASTR.TITLE.SUCCESS')
				);
			}),
			// Update the subject with a value of true
			tap(() => this.subject$.next(true)),
			// Handle component lifecycle to avoid memory leaks
			untilDestroyed(this)
		).subscribe();
	}

	/**
	 * Open a dialog to set GitHub integration settings.
	 *
	 * @returns
	 */
	private openDialog(): Observable<boolean> {
		// Open a dialog to configure GitHub settings
		const dialogRef = this._dialogService.open(GithubSettingsDialogComponent, {
			context: {
				integration: this.integration // Pass the 'integration' object to the dialog component
			}
		});
		// Return an Observable that emits a boolean when the dialog is closed
		return dialogRef.onClose.pipe(first());
	}

	/**
	 * Open a dialog to set GitHub integration settings.
	 */
	async openSettingModal() {
		// Check if the 'integration' object is falsy and return early if it is
		if (!this.integration) {
			return;
		}

		// Wait for the dialog to close and retrieve the data returned from the dialog
		const data = await firstValueFrom(this.openDialog());
		if (data) {
			// Extract the 'id' property from the 'integration' object
			const { id: integrationId } = this.integration;

			// Use try-catch for better error handling
			try {
				// Retrieve the current settings from the service
				const { currentValue: settings }: IEntitySettingToSync = this._integrationEntitySettingServiceStoreService.getEntitySettingsValue();

				// Update entity settings if needed
				await firstValueFrom(
					this._integrationEntitySettingService.updateEntitySettings(
						integrationId,
						settings
					)
				);

				this._toastrService.success(
					this.getTranslation('INTEGRATIONS.MESSAGE.SETTINGS_UPDATED', { provider: IntegrationEnum.GITHUB }),
					this.getTranslation('TOASTR.TITLE.SUCCESS')
				);
				// Optionally, you can provide feedback or handle success here
			} catch (error) {
				// Handle errors (e.g., display an error message or log the error)
				console.error('Error updating entity settings:', error);
				// Optionally, you can provide error feedback to the user
				this._errorHandlingService.handleError(error);
			}
		}
	}

	/**
	 * Updates the selected issues based on the user's selection.
	 * @param selected - An array of selected issues.
	 */
	selectIssues({ selected }: { selected: any[] }): void {
		this.selectedIssues = selected;
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
			const repository = this.repository;

			// Create a request object for syncing the GitHub repository
			const repositorySyncRequest: IIntegrationMapSyncRepository = {
				organizationId,
				tenantId,
				integrationId,
				repository
			};

			// Synchronize the GitHub repository and update project settings
			this._githubService.syncGithubRepository(repositorySyncRequest)
				.pipe(
					switchMap(({ id: repositoryId }: IOrganizationGithubRepository) =>
						this._organizationProjectsService.updateProjectSetting(projectId, {
							organizationId,
							tenantId,
							repositoryId,
							syncTag: SYNC_TAG_GAUZY
						})
					),
					tap((response: any) => {
						if (response['status'] == HttpStatus.BAD_REQUEST) {
							throw new Error(`${response['message']}`);
						}
					}),
					tap(() => this.subject$.next(true)),
					switchMap(() =>
						this._githubService.autoSyncIssues(integrationId, this.repository, {
							projectId,
							organizationId,
							tenantId
						})
					),
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
					}),
					catchError((error) => {
						this._errorHandlingService.handleError(error);
						return EMPTY;
					}),
					// Execute the following code block when the observable completes or errors
					finalize(() => this.syncing = this.loading = false),
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
			const repository = this.repository;

			// Create a request object for syncing the GitHub repository
			const repositorySyncRequest: IIntegrationMapSyncRepository = {
				organizationId,
				tenantId,
				integrationId,
				repository
			};

			// Synchronize the GitHub repository and update project settings
			this._githubService.syncGithubRepository(repositorySyncRequest)
				.pipe(
					switchMap(({ id: repositoryId }: IOrganizationGithubRepository) =>
						this._organizationProjectsService.updateProjectSetting(projectId, {
							organizationId,
							tenantId,
							repositoryId,
							syncTag: SYNC_TAG_GAUZY
						})
					),
					switchMap(() =>
						this._githubService.manualSyncIssues(
							integrationId,
							this.repository,
							{
								projectId,
								organizationId,
								tenantId,
								issues: this.selectedIssues
							},
						)
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
						this.subject$.next(true);
						this.resetTableSelectedItems();
					}),
					catchError((error) => {
						// Handle and log errors
						console.error('Error while syncing GitHub issues & labels manually:', error.message);
						this._errorHandlingService.handleError(error);
						return EMPTY;
					}),
					// Execute the following code block when the observable completes or errors
					finalize(() => this.syncing = this.loading = false),
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
				badgeClass = 'primary';
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
			class: badgeClass,
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
