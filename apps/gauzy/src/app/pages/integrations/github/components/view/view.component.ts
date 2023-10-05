import { AfterViewInit, Component, OnInit } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Data } from '@angular/router';
import { debounceTime, firstValueFrom, of } from 'rxjs';
import { Observable } from 'rxjs/internal/Observable';
import { catchError, filter, map, switchMap, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService, NbMenuItem, NbMenuService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IEntitySettingToSync, IGithubIssue, IGithubRepository, IGithubRepositoryResponse, IOrganization, IntegrationEnum } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/common-angular';
import { TranslationBaseComponent } from './../../../../../@shared/language-base';
import {
	ErrorHandlingService,
	GithubService,
	IntegrationEntitySettingService,
	IntegrationEntitySettingServiceStoreService,
	IntegrationsService,
	Store,
	ToastrService
} from './../../../../../@core/services';
import { GithubSettingsDialogComponent } from '../settings-dialog/settings-dialog.component';
import { IIntegrationTenant } from 'packages/contracts/dist';

@UntilDestroy({ checkProperties: true })
@Component({
	styleUrls: ['./view.component.scss'],
	templateUrl: './view.component.html',
	providers: [
		TitleCasePipe
	]
})
export class GithubViewComponent extends TranslationBaseComponent implements AfterViewInit, OnInit {

	public contextMenuItems: NbMenuItem[] = [];
	public settingsSmartTable: object;
	public organization: IOrganization;
	public loading: boolean;
	public repositories: IGithubRepository[] = [];
	public repositories$: Observable<IGithubRepository[]>;
	public issues$: Observable<any[]>;
	public issues: IGithubIssue[] = [];
	private integration: IIntegrationTenant;

	constructor(
		public readonly _translateService: TranslateService,
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _titlecasePipe: TitleCasePipe,
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
	}

	ngAfterViewInit(): void {
		this._store.selectedOrganization$
			.pipe(
				debounceTime(200),
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => this.organization = organization),
				tap(() => this.getRepositories()),
				untilDestroyed(this)
			)
			.subscribe();
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
	 *
	 */
	private _getContextMenuItems() {
		this.contextMenuItems = [
			{
				title: this.getTranslation('INTEGRATIONS.SETTINGS'),
				icon: 'settings-2-outline'
			}
		];
	}

	/**
	 * Fetches repositories for a given integration and organization.
	 */
	private getRepositories() {
		// Ensure there is a valid organization
		if (!this.organization) {
			return;
		}

		this.loading = true;

		// Extract organization properties
		const { id: organizationId, tenantId } = this.organization;
		this.repositories$ = this._activatedRoute.parent.data.pipe(
			filter(({ integration }: Data) => !!integration),
			tap(({ integration }: Data) => this.integration = integration),
			switchMap(() => this._activatedRoute.params.pipe(
				filter(({ integrationId }) => integrationId)
			)),
			// Get the 'integrationId' route parameter
			switchMap(({ integrationId }) => this._githubService.getRepositories(integrationId, {
				organizationId,
				tenantId
			})),
			// Update component state with fetched repositories
			tap(({ repositories }: IGithubRepositoryResponse) => {
				this.repositories = repositories;
			}),
			map(({ repositories }) => repositories),
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
	 * Selects a GitHub repository and retrieves its associated issues.
	 * @param repository - The GitHub repository to select.
	 */
	public selectRepository(repository: IGithubRepository) {
		// If a repository is provided, call 'getRepositoryIssue' to fetch its issues.
		// If no repository is provided, emit an empty array.
		this.issues$ = repository ? this.getRepositoryIssue(repository) : of([]);
	}

	/**
	 *
	 * @param repository
	 * @returns
	 */
	private getRepositoryIssue(repository: IGithubRepository): Observable<IGithubIssue[]> {
		// Ensure there is a valid organization
		if (!this.organization) {
			return;
		}
		const owner = repository.owner['login'];
		const repo = repository.name;

		this.loading = true;
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
					valuePrepareFunction: (data: string) => {
						console.log(data); // Log column data (you can modify this function)
						return data; // Return the data as-is (modify this function as needed)
					}
				},
				title: {
					title: this.getTranslation('SM_TABLE.TITLE'), // Set column title based on translation
					type: 'string' // Set column type to 'string'
				},
				state: {
					title: this.getTranslation('SM_TABLE.STATUS'), // Set column title based on translation
					type: 'string', // Set column type to 'string'
					valuePrepareFunction: (data: string) => {
						// Transform the column data using '_titlecasePipe.transform' (modify this function)
						return this._titlecasePipe.transform(data);
					}
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
}
