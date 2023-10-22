import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { EMPTY, catchError, map, tap } from 'rxjs';
import { debounceTime, filter, switchMap } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/common-angular';
import { IIntegrationTenant, IOrganization, IPagination } from '@gauzy/contracts';
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
	 *
	 * @param integration
	 */
	async view(integration: IIntegrationTenant) {
		console.log(integration);
	}

	/**
	 * Function to delete an integration
	 *
	 * @param integration
	 */
	deleteIntegration(integration: IIntegrationTenant) {
		// Open a confirmation dialog and get the result
		const onClose$ = this._nbDialogService.open(DeleteConfirmationComponent).onClose;
		onClose$
			.pipe(
				filter((result) => !!result), // Check if the result is true (confirmed)
				switchMap(() => this._integrationTenantService.delete(integration.id)), // Perform the delete operation
				tap(() => {
					this._toastrService.success(this.getTranslation('INTEGRATIONS.MESSAGE.INTEGRATION_DELETED'), {
						provider: integration?.integration?.provider
					});
				}),
				untilDestroyed(this) // Automatically unsubscribe when the component is destroyed
			)
			.subscribe();
	}

	/**
	 * Navigate to the create project page.
	 */
	navigateToNewIntegrations(): void {
		this._router.navigate(['/pages/integrations/new']);
	}
}
