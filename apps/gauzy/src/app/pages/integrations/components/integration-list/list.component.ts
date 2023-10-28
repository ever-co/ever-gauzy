import { AfterViewInit, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { EMPTY, Subject, catchError, first, map, of, tap } from 'rxjs';
import { debounceTime, filter, switchMap } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/common-angular';
import { IIntegration, IIntegrationTenant, IOrganization, IPagination } from '@gauzy/contracts';
import { ErrorHandlingService, IntegrationTenantService, Store } from './../../../../@core/services';
import { TranslationBaseComponent } from './../../../../@shared/language-base';
import { DeleteConfirmationComponent } from './../../../../@shared/user/forms';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-integration-list',
	templateUrl: './list.component.html',
	styleUrls: ['./list.component.scss']
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
		this._store.selectedOrganization$
			.pipe(
				debounceTime(100),
				filter((organization: IOrganization) => !!organization), // Filter out undefined or falsy values
				distinctUntilChange(),
				tap((organization: IOrganization) => this.organization = organization),
				tap(() => this.getIntegrations()),
				// Handle component lifecycle to avoid memory leaks
				untilDestroyed(this),
			)
			.subscribe();
	}

	ngAfterViewInit(): void {
		this.subject$
			.pipe(
				debounceTime(100),
				tap(() => this.getIntegrations()),
				// Handle component lifecycle to avoid memory leaks
				untilDestroyed(this),
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
		confirmed$
			.pipe(
				filter((isConfirmed) => isConfirmed),
				switchMap(() => this._integrationTenantService.delete(integration.id)),
				tap(() => this.showDeletionSuccessMessage(integration)),
				tap(() => this.subject$.next(true)),
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
