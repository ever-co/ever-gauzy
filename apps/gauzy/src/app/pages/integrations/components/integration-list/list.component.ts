import { AfterViewInit, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { EMPTY, Subject, catchError, first, map, of, tap } from 'rxjs';
import { debounceTime, filter, switchMap } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import {
	HttpStatus,
	IIntegration,
	IIntegrationTenant,
	IOrganization,
	IPagination,
	IntegrationEnum
} from '@gauzy/contracts';
import {
	ErrorHandlingService,
	IntegrationEntitySettingServiceStoreService,
	IntegrationTenantService,
	IntegrationsService,
	Store
} from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { DeleteConfirmationComponent } from '@gauzy/ui-core/shared';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ga-integration-list',
    templateUrl: './list.component.html',
    styleUrls: ['./list.component.scss'],
    standalone: false
})
export class IntegrationListComponent extends TranslationBaseComponent implements AfterViewInit, OnInit {
	public loading: boolean = false; // Flag to indicate if data loading is in progress
	public organization: IOrganization;
	public integrations$: Observable<IIntegrationTenant[]>;
	public integrations: IIntegrationTenant[] = [];
	private subject$: Subject<boolean> = new Subject();

	/**
	 * Configuration for integrations.
	 */
	public providers: { [key: string]: any } = {
		Github: {
			description: this.getTranslation('INTEGRATIONS.GITHUB_PAGE.DESCRIPTION')
		},
		Gauzy_AI: {
			description: this.getTranslation('INTEGRATIONS.GAUZY_AI_PAGE.DESCRIPTION')
		},
		Hubstaff: {
			description: this.getTranslation('INTEGRATIONS.HUBSTAFF_PAGE.DESCRIPTION')
		},
		Upwork: {
			description: this.getTranslation('INTEGRATIONS.UPWORK_PAGE.DESCRIPTION')
		}
	};

	constructor(
		private readonly _router: Router,
		private readonly _nbDialogService: NbDialogService,
		private readonly _toastrService: NbToastrService,
		public readonly _translateService: TranslateService,
		private readonly _store: Store,
		private readonly _integrationTenantService: IntegrationTenantService,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly _integrationsService: IntegrationsService,
		private readonly _integrationEntitySettingServiceStoreService: IntegrationEntitySettingServiceStoreService
	) {
		super(_translateService);
	}

	ngOnInit(): void {
		this._store.selectedOrganization$
			.pipe(
				debounceTime(100),
				filter((organization: IOrganization) => !!organization), // Filter out undefined or falsy values
				distinctUntilChange(),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this.getIntegrations()),
				// Handle component lifecycle to avoid memory leaks
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit(): void {
		this.subject$
			.pipe(
				debounceTime(100),
				tap(() => this.getIntegrations()),
				// Handle component lifecycle to avoid memory leaks
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Fetch integrations for the current organization and populate the 'integrations$' observable.
	 * This method retrieves integrations associated with the selected organization and updates
	 * the 'integrations$' observable with the retrieved data.
	 * If there is no organization selected, it returns early.
	 *
	 * @returns
	 */
	private getIntegrations() {
		// Ensure there is a valid organization
		if (!this.organization) {
			return of([]); // Return an empty observable if there is no organization
		}

		this.loading = true;

		// Extract organization properties
		const { id: organizationId, tenantId } = this.organization;

		this.integrations$ = this._integrationTenantService.getAll({ organizationId, tenantId }, ['integration']).pipe(
			map(({ items }: IPagination<IIntegrationTenant>) => items),
			catchError((error) => {
				// Handle and log errors
				this._errorHandlingService.handleError(error);
				return EMPTY;
			}),
			// Update component state with fetched issues
			tap((integrations: IIntegrationTenant[]) => {
				this.integrations = integrations;
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
			untilDestroyed(this)
		);
	}

	/**
	 * Update the state of an integration and handle various side effects.
	 *
	 * @param integration - The integration to update.
	 * @param isActive - A boolean indicating whether the integration should be active.
	 */
	public updateIntegrationTenant(integration: IIntegrationTenant, isActive: boolean) {
		if (!integration) {
			return; // If integration is missing, exit the function.
		}
		const { organizationId, tenantId } = integration;

		// Update the integration using the _integrationTenantService.
		this._integrationTenantService
			.update(integration.id, {
				isActive: isActive,
				isArchived: !isActive,
				tenantId,
				organizationId
			})
			.pipe(
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
				tap(() => {
					// Determine the success message based on whether 'isActive' is true or false.
					const message = isActive
						? 'INTEGRATIONS.MESSAGE.INTEGRATION_ENABLED'
						: 'INTEGRATIONS.MESSAGE.INTEGRATION_DISABLED';

					// Display a success toast message using the _toastrService.
					this._toastrService.success(
						this.getTranslation(message, { provider: integration?.integration?.name }),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
				}),
				// Update the subject with a value of true
				tap(() => this.subject$.next(true)),
				//
				tap((integration: IIntegrationTenant) => {
					if (integration.name === IntegrationEnum.GAUZY_AI) {
						this.updateAIJobMatchingEntity();
					}
				}),
				// Handle component lifecycle to avoid memory leaks
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Updates integration settings, specifically the job matching entity setting.
	 * If the organization is not available, the function exits early.
	 * The function fetches integration data based on specified options, then updates the job matching entity setting.
	 */
	updateAIJobMatchingEntity(): void {
		// Check if the organization is available
		if (!this.organization) {
			return;
		}

		// Extract necessary properties from the organization
		const { id: organizationId, tenantId } = this.organization;

		// Fetch integration data from the service based on specified options
		const integration$ = this._integrationsService.getIntegrationByOptions({
			organizationId,
			tenantId,
			name: IntegrationEnum.GAUZY_AI,
			relations: ['entitySettings']
		});

		// Update job matching entity setting using the integration$ observable
		this._integrationEntitySettingServiceStoreService.updateAIJobMatchingEntity(integration$).subscribe();
	}

	/**
	 * Function to view an integration
	 *
	 * @param integration
	 */
	viewIntegration(integration: IIntegrationTenant) {
		if (!integration) {
			return;
		}
		this._router.navigate(['/pages/integrations', integration.integration?.redirectUrl, integration.id]);
	}

	/**
	 * Delete an integration after confirming with a dialog.
	 *
	 * @param integration - The integration to be deleted.
	 */
	deleteIntegration(integration: IIntegrationTenant): void {
		const dialog$ = this.openConfirmationDialog();
		dialog$
			.pipe(
				filter((isConfirmed) => isConfirmed),
				switchMap(() => this._integrationTenantService.delete(integration.id)),
				tap(() => {
					this.showDeletionSuccessMessage(integration);
					this.subject$.next(true);

					if (integration.name === IntegrationEnum.GAUZY_AI) {
						this.updateAIJobMatchingEntity();
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Open a confirmation dialog to confirm the deletion.
	 *
	 * @returns An observable that emits a boolean value indicating whether the deletion is confirmed.
	 */
	private openConfirmationDialog(): Observable<boolean> {
		const dialogRef = this._nbDialogService.open(DeleteConfirmationComponent);
		return dialogRef.onClose.pipe(first());
	}

	/**
	 * Show a success message after the integration is deleted.
	 *
	 * @param integration - The deleted integration.
	 */
	private showDeletionSuccessMessage(integration: IIntegrationTenant): void {
		const successMessage = this.getTranslation('INTEGRATIONS.MESSAGE.INTEGRATION_DELETED', {
			provider: integration?.integration?.provider
		});
		this._toastrService.success(successMessage, this.getTranslation('TOASTR.TITLE.SUCCESS'));
	}

	/**
	 * Get the description of an integration provider based on the integration object.
	 * @param integration - The integration object containing provider information.
	 * @returns The description of the integration provider, or undefined if the provider is missing or not found.
	 */
	getProviderDescription(integration: IIntegration): string | null {
		if (!integration) {
			return;
		}
		return integration.provider ? this.providers[integration.provider]?.description : null;
	}

	/**
	 * Navigate to the "New Integrations" page.
	 */
	navigateToNewIntegrations(): void {
		this._router.navigate(['/pages/integrations/new']);
	}
}
