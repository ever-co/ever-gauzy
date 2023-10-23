import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { EMPTY, catchError, first, map, tap } from 'rxjs';
import { debounceTime, filter, switchMap } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/common-angular';
import { IIntegration, IIntegrationTenant, IOrganization, IPagination } from '@gauzy/contracts';
import { ErrorHandlingService, IntegrationTenantService, Store } from './../../../../@core/services';
import { TranslationBaseComponent } from './../../../../@shared/language-base';
import { DeleteConfirmationComponent } from 'apps/gauzy/src/app/@shared/user/forms';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-integration-list',
	templateUrl: './list.component.html',
	styleUrls: ['./list.component.scss'],
	providers: []
})
export class IntegrationListComponent extends TranslationBaseComponent implements OnInit {

	public organization: IOrganization;
	public integrations$: Observable<IIntegrationTenant[]>;

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
		},
	};

	constructor(
		private readonly _router: Router,
		private readonly _nbDialogService: NbDialogService,
		private readonly _toastrService: NbToastrService,
		public readonly _translateService: TranslateService,
		private readonly _store: Store,
		private readonly _integrationTenantService: IntegrationTenantService,
		private readonly _errorHandlingService: ErrorHandlingService,
	) {
		super(_translateService);
	}

	ngOnInit(): void {
		this.integrations$ = this._store.selectedOrganization$.pipe(
			debounceTime(100),
			distinctUntilChange(),
			switchMap((organization: IOrganization) => {
				// Ensure there is a valid organization
				if (!organization) {
					return EMPTY;
				}

				this.organization = organization;
				// Extract organization properties
				const { id: organizationId, tenantId } = this.organization;

				return this._integrationTenantService.getAll({ organizationId, tenantId }, ['integration']).pipe(
					map(({ items }: IPagination<IIntegrationTenant>) => items),
					catchError((error) => {
						// Handle and log errors
						this._errorHandlingService.handleError(error);
						return EMPTY;
					}),
					// Handle component lifecycle to avoid memory leaks
					untilDestroyed(this),
				);
			}),
			// Handle component lifecycle to avoid memory leaks
			untilDestroyed(this),
		);
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
		const confirmed$ = this.openConfirmationDialog();
		confirmed$.pipe(
			filter((isConfirmed) => isConfirmed),
			switchMap(() => this._integrationTenantService.delete(integration.id)),
			tap(() => this.showDeletionSuccessMessage(integration)),
			untilDestroyed(this)
		).subscribe();
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
		this._toastrService.success(successMessage);
	}

	/**
	 * Get the description of an integration provider based on the integration object.
	 * @param integration - The integration object containing provider information.
	 * @returns The description of the integration provider, or undefined if the provider is missing or not found.
	 */
	getProviderDescription(integration: IIntegration): string | null {
		return integration.provider ? this.providers[integration.provider]?.description : null;
	}

	/**
	 * Navigate to the "New Integrations" page.
	 */
	navigateToNewIntegrations(): void {
		this._router.navigate(['/pages/integrations/new']);
	}
}
