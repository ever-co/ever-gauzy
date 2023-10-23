import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Data, Router } from '@angular/router';
import { EMPTY, debounceTime, finalize, first, firstValueFrom, of } from 'rxjs';
import { Observable } from 'rxjs/internal/Observable';
import { catchError, filter, map, switchMap, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Ng2SmartTableComponent } from 'ng2-smart-table';
import {
	IEntitySettingToSync,
	IGithubIssue,
	IGithubRepository,
	IIntegrationTenant,
	IOrganization,
	IOrganizationProject,
	IUser,
	IntegrationEnum
} from '@gauzy/contracts';
import { distinctUntilChange, parsedInt } from '@gauzy/common-angular';
import { TranslationBaseComponent } from './../../../../../@shared/language-base';
import {
	ErrorHandlingService,
	GithubService,
	IntegrationEntitySettingService,
	IntegrationEntitySettingServiceStoreService,
	OrganizationProjectsService,
	Store,
	ToastrService
} from './../../../../../@core/services';
import { HashNumberPipe } from './../../../../../@shared/pipes';
import { ClickableLinkComponent, TagsOnlyComponent, TrustHtmlLinkComponent } from './../../../../../@shared/table-components';
import { GithubSettingsDialogComponent } from '../settings-dialog/settings-dialog.component';

@UntilDestroy({ checkProperties: true })
@Component({
	styleUrls: ['./view.component.scss'],
	templateUrl: './view.component.html',
	providers: [
		TitleCasePipe
	]
})
export class GithubViewComponent extends TranslationBaseComponent implements OnInit {
	public parsedInt = parsedInt;

	public syncing: boolean = false;
	public loading: boolean = false;
	public user: IUser = this._store.user;
	public organization: IOrganization = this._store.selectedOrganization;
	public repository: IGithubRepository;
	public project: IOrganizationProject;
	public project$: Observable<IOrganizationProject>;
	public integration$: Observable<IIntegrationTenant>;
	public integration: IIntegrationTenant;
	public settingsSmartTable: object;
	public issues$: Observable<IGithubIssue[]>;
	public issues: IGithubIssue[] = [];
	public selectedIssues: IGithubIssue[] = [];

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
		this._getGithubIntegrationTenant();

		this.project$ = this._store.selectedProject$.pipe(
			debounceTime(100),
			distinctUntilChange(),
			filter((project: IOrganizationProject) => !!project),
			switchMap((project: IOrganizationProject) => {
				// Ensure there is a valid organization
				if (!project.id) {
					return EMPTY; // No valid organization, return false
				}
				// Extract project properties
				const { id: projectId } = this.project = project;

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
	 * Fetches and sets the GitHub integration data from the route's data property.
	 */
	private _getGithubIntegrationTenant() {
		this.integration$ = this._activatedRoute.parent.data.pipe(
			map(({ integration }: Data) => integration),
			tap((integration: IIntegrationTenant) => this.integration = integration),
			untilDestroyed(this) // Automatically unsubscribes when the component is destroyed
		);
	}

	/**
	 * Selects a GitHub repository and retrieves its associated issues.
	 * @param repository - The GitHub repository to select.
	 */
	public selectRepository(repository: IGithubRepository): void {
		this.selectedIssues = [];
		this.repository = repository;

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
		this.settingsSmartTable = {
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
					type: 'string' // Set column type to 'string'
				},
				body: {
					title: this.getTranslation('SM_TABLE.DESCRIPTION'), // Set column title based on translation
					type: 'custom', // Set column type to 'custom'
					renderComponent: TrustHtmlLinkComponent
				},
				state: {
					title: this.getTranslation('SM_TABLE.STATUS'), // Set column title based on translation
					type: 'string', // Set column type to 'string'
					valuePrepareFunction: (data: string) => {
						// Transform the column data using '_titlecasePipe.transform' (modify this function)
						return this._titlecasePipe.transform(data);
					}
				},
				labels: {
					title: this.getTranslation('SM_TABLE.LABELS'),
					type: 'custom',
					renderComponent: TagsOnlyComponent,
					width: '10%'
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

	/** */
	selectIssues({ selected }) {
		this.selectedIssues = selected;
	}

	/**
	 * Sync GitHub issues and labels for the selected organization and integration.
	 * It uses the selectedIssues property to determine which issues to sync.
	 */
	syncIssues() {
		try {
			// Check if there is a valid organization and integration
			if (!this.organization || !this.repository) {
				return;
			}
			// Check if another synchronization is already in progress
			if (this.syncing) {
				return;
			}

			this.syncing = true;

			const { id: organizationId, tenantId } = this.organization;
			const { id: integrationId } = this.integration;

			// Call the syncIssuesAndLabels method from the _githubService
			// to initiate the synchronization process.
			this._githubService.syncIssuesAndLabels(
				integrationId,
				this.repository,
				{
					...(this.project
						? {
							projectId: this.project.id
						}
						: {}),
					organizationId,
					tenantId,
					issues: this.selectedIssues
				},
			).pipe(
				tap(() => {
					this._toastrService.success(
						this.getTranslation('INTEGRATIONS.GITHUB_PAGE.SYNCED_ISSUES', {
							repository: this.repository.full_name
						}),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
					this.resetTableSelectedItems();
				}),
				catchError((error) => {
					// Handle and log errors
					console.error('Error while syncing GitHub issues & labels:', error.message);
					this._errorHandlingService.handleError(error);
					return of(null);
				}),
				finalize(() => this.syncing = false),
				untilDestroyed(this) // Ensure subscription is cleaned up on component destroy
			).subscribe();
		} catch (error) {
			// Handle errors (e.g., display an error message or log the error)
			console.error('Error while syncing GitHub issues & labels:', error.message);

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
