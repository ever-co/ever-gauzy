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
	SYNC_TAG_GAUZY
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
import { TranslationBaseComponent } from './../../../../../@shared/language-base';
import { StatusBadgeComponent } from './../../../../../@shared/status-badge';
import { HashNumberPipe } from './../../../../../@shared/pipes';
import {
	ClickableLinkComponent,
	ProjectComponent,
	GithubRepositoryComponent,
	TagsOnlyComponent,
	TrustHtmlLinkComponent,
	GithubAutoSyncSwitchComponent
} from './../../../../../@shared/table-components';
import { GithubSettingsDialogComponent } from '../settings-dialog/settings-dialog.component';

@UntilDestroy({ checkProperties: true })
@Component({
	styleUrls: ['./view.component.scss'],
	templateUrl: './view.component.html',
	providers: [TitleCasePipe]
})
export class GithubViewComponent extends TranslationBaseComponent implements AfterViewInit, OnInit {

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
	public autoSyncClick$: BehaviorSubject<boolean> = new BehaviorSubject(true); // Subject for auto-sync click events
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
		this.projects$ = this.autoSyncClick$.pipe(
			filter(() => !!this.organization),
			switchMap(() => {
				// Extract project properties
				const { id: organizationId, tenantId } = this.organization;
				// Ensure there is a valid organization
				if (!organizationId) {
					return of([]); // No valid organization, return false
				}
				return this._organizationProjectsService.findSyncedProjects({ organizationId, tenantId }, ['repository']).pipe(
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
	 * Selects a GitHub repository manually and fetches its issues.
	 *
	 * @param repository The GitHub repository to select.
	 */
	public selectManualRepository(repository: IGithubRepository): void {
		// Set the 'repository' property to the provided 'repository' object.
		this.repository = repository;

		// Initialize the 'selectedIssues' property with an empty array.
		this.selectedIssues = [];

		// If a repository is provided, call 'getRepositoryIssue' to fetch its issues.
		// If no repository is provided, emit an empty array.
		this.issues$ = repository ? this.getRepositoryIssue(repository) : of([]);
	}

	/**
	 * Fetches issues for a given repository.
	 *
	 * @param repository
	 * @returns
	 */
	private getRepositoryIssue(repository: IGithubRepository): Observable<IGithubIssue[]> {
		// Ensure there is a valid organization
		if (!this.organization) {
			return of([]); // Return an empty observable if there is no organization
		}

		this.loading = true;

		const owner = repository.owner['login'];
		const repo = repository.name;

		// Extract organization properties
		const { id: organizationId, tenantId } = this.organization;

		return this._activatedRoute.parent.data.pipe(
			filter(({ integration }: Data) => !!integration),
			switchMap(() => this._activatedRoute.params.pipe(
				filter(({ integrationId }) => integrationId)
			)),
			// Get the 'integrationId' route parameter
			switchMap(({ integrationId }) => {
				return this._githubService.getRepositoryIssues(integrationId, owner, repo, {
					organizationId,
					tenantId,
				});
			}),
			// Update component state with fetched issues
			tap((issues: IGithubIssue[]) => {
				this.issues = issues;
			}),
			catchError((error) => {
				// Handle and log errors
				this._errorHandlingService.handleError(error);
				return of([]);
			}),
			tap(() => {
				this.loading = false;
			}),
			// Handle component lifecycle to avoid memory leaks
			untilDestroyed(this),
		);
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
				title: {
					title: this.getTranslation('SM_TABLE.TITLE'), // Set column title based on translation
					width: '15%',
					type: 'string' // Set column type to 'string'
				},
				body: {
					title: this.getTranslation('SM_TABLE.DESCRIPTION'), // Set column title based on translation
					width: '60%',
					type: 'custom', // Set column type to 'custom'
					renderComponent: TrustHtmlLinkComponent
				},
				state: {
					title: this.getTranslation('SM_TABLE.STATUS'), // Set column title based on translation
					width: '5%',
					type: 'string', // Set column type to 'string'
					valuePrepareFunction: (data: string) => {
						// Transform the column data using '_titlecasePipe.transform' (modify this function)
						return this._titlecasePipe.transform(data);
					}
				},
				labels: {
					title: this.getTranslation('SM_TABLE.LABELS'), // Set column labels based on translation
					width: '15%',
					type: 'custom', // Set column type to 'custom'
					renderComponent: TagsOnlyComponent,
				}
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
							next: (hasSynced: boolean) => {
								console.log(hasSynced)
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
			this.syncing = true;

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
					tap(() => this.autoSyncClick$.next(true)),
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
						this.autoSyncClick$.next(true);
					}),
					catchError((error) => {
						this._errorHandlingService.handleError(error);
						return EMPTY;
					}),
					// Execute the following code block when the observable completes or errors
					finalize(() => this.syncing = false),
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
			this.syncing = true;

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
						this.autoSyncClick$.next(true);
						this.resetTableSelectedItems();
					}),
					catchError((error) => {
						// Handle and log errors
						console.error('Error while syncing GitHub issues & labels manually:', error.message);
						this._errorHandlingService.handleError(error);
						return EMPTY;
					}),
					// Execute the following code block when the observable completes or errors
					finalize(() => this.syncing = false),
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
	 * Maps the status of a GitHub repository to a format including text representation, original status value, and CSS class.
	 * @param row - An object representing a GitHub repository with a 'status' property.
	 * @returns An object with 'text', 'value', and 'class' properties.
	 */
	statusMapper(row: IOrganizationGithubRepository): { text: string; value: string; class: string } {
		let value: string = row.status;
		let badgeClass: string;

		switch (row.status) {
			case GithubRepositoryStatusEnum.SYNCING:
				badgeClass = 'success';
				break;
			case GithubRepositoryStatusEnum.ERROR:
				badgeClass = 'danger';
				break;
			case GithubRepositoryStatusEnum.PENDING:
				badgeClass = 'warning';
				break;
			default:
				badgeClass = 'warning';
				break;
		}

		return {
			text: this._titlecasePipe.transform(row.status),
			value: value,
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
