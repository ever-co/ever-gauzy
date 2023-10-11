import { AfterViewInit, Component, OnInit } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Data } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { Observable } from 'rxjs/internal/Observable';
import { catchError, filter, map, switchMap, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService, NbMenuItem, NbMenuService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	IEntitySettingToSync,
	IGithubIssue,
	IGithubRepository,
	IIntegrationTenant,
	IOrganization,
	IUser,
	IntegrationEnum
} from '@gauzy/contracts';
import { TranslationBaseComponent } from './../../../../../@shared/language-base';
import {
	ErrorHandlingService,
	GithubService,
	IntegrationEntitySettingService,
	IntegrationEntitySettingServiceStoreService,
	Store,
	ToastrService
} from './../../../../../@core/services';
import { HashNumberPipe } from './../../../../../@shared/pipes';
import { TagsOnlyComponent } from './../../../../../@shared/table-components';
import { GithubSettingsDialogComponent } from '../settings-dialog/settings-dialog.component';

@UntilDestroy({ checkProperties: true })
@Component({
	styleUrls: ['./view.component.scss'],
	templateUrl: './view.component.html',
	providers: [
		TitleCasePipe
	]
})
export class GithubViewComponent extends TranslationBaseComponent implements AfterViewInit, OnInit {

	public user: IUser = this._store.user;
	public organization: IOrganization = this._store.selectedOrganization;
	public repository: IGithubRepository;
	public integration$: Observable<IIntegrationTenant>;
	public integration: IIntegrationTenant;
	public contextMenuItems: NbMenuItem[] = [];
	public settingsSmartTable: object;
	public loading: boolean;
	public issues$: Observable<IGithubIssue[]>;
	public issues: IGithubIssue[] = [];
	public selectedIssues: IGithubIssue[] = [];

	constructor(
		public readonly _translateService: TranslateService,
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _titlecasePipe: TitleCasePipe,
		private readonly _hashNumberPipe: HashNumberPipe,
		private readonly _nbMenuService: NbMenuService,
		private readonly _dialogService: NbDialogService,
		private readonly _toastrService: ToastrService,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly _store: Store,
		private readonly _githubService: GithubService,
		private readonly _integrationEntitySettingService: IntegrationEntitySettingService,
		private readonly _integrationEntitySettingServiceStoreService: IntegrationEntitySettingServiceStoreService,
	) {
		super(_translateService);
	}

	ngOnInit(): void {
		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();
		this._getContextMenuItems();
		this._getGithubIntegrationTenant();
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

	ngAfterViewInit(): void {
		/** */
		const onItemClick$ = this._nbMenuService.onItemClick();
		onItemClick$
			.pipe(
				map(({ item: { icon } }) => icon),
				tap((icon) => {
					if (icon === 'settings-2-outline') {
						this.setSettings();
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Sets up context menu items.
	 */
	private _getContextMenuItems() {
		this.contextMenuItems = [
			{
				title: this.getTranslation('INTEGRATIONS.SETTINGS'),
				icon: 'settings-2-outline'
			},
			// Add more menu items as needed
		];
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
					type: 'number', // Set column type to 'number'
					valuePrepareFunction: (data: number) => {
						return this._hashNumberPipe.transform(data);
					}
				},
				title: {
					title: this.getTranslation('SM_TABLE.TITLE'), // Set column title based on translation
					type: 'string' // Set column type to 'string'
				},
				body: {
					title: this.getTranslation('SM_TABLE.DESCRIPTION'), // Set column title based on translation
					type: 'string' // Set column type to 'string'
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
	 */
	async setSettings() {
		// Check if the 'integration' object is falsy and return early if it is
		if (!this.integration) {
			return;
		}

		// Open a dialog using the '_dialogService.open' method
		const dialog = this._dialogService.open(GithubSettingsDialogComponent, {
			context: {
				integration: this.integration // Pass the 'integration' object to the dialog component
			}
		});

		// Wait for the dialog to close and retrieve the data returned from the dialog
		const data = await firstValueFrom(dialog.onClose);

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

			const { id: organizationId, tenantId } = this.organization;
			const { id: integrationId } = this.integration;

			// Call the syncIssuesAndLabels method from the _githubService
			// to initiate the synchronization process.
			this._githubService.syncIssuesAndLabels(
				integrationId,
				this.repository,
				{
					organizationId,
					tenantId,
					issues: this.selectedIssues
				},
			).pipe(
				tap(() => {
					this._toastrService.success(
						this.getTranslation('INTEGRATIONS.GITHUB_PAGE.SYNCED_ISSUES', {
							repository: this.repository.name
						}),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
				}),
				catchError((error) => {
					// Handle and log errors
					console.error('Error while syncing GitHub issues & labels:', error.message);
					this._errorHandlingService.handleError(error);
					return of(null);
				}),
				untilDestroyed(this) // Ensure subscription is cleaned up on component destroy
			).subscribe();
		} catch (error) {
			// Handle errors (e.g., display an error message or log the error)
			console.error('Error while syncing GitHub issues & labels:', error.message);

			// Optionally, you can provide error feedback to the user
			this._errorHandlingService.handleError(error);
		}
	}
}
