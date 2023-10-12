import { AfterViewInit, Component, OnInit } from '@angular/core';
import { EMPTY, catchError, map } from 'rxjs';
import { debounceTime, switchMap } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/common-angular';
import { IIntegrationTenant, IOrganization, IPagination } from '@gauzy/contracts';
import { ErrorHandlingService, IntegrationTenantService, Store } from './../../../../@core/services';
import { TranslationBaseComponent } from './../../../../@shared/language-base';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-integration-list',
	templateUrl: './list.component.html',
	styleUrls: ['./list.component.scss']
})
export class IntegrationListComponent extends TranslationBaseComponent implements AfterViewInit, OnInit {

	public settingsSmartTable: object;
	public organization: IOrganization;
	public integrations$: Observable<IIntegrationTenant[]>;

	constructor(
		public readonly _translateService: TranslateService,
		private readonly _store: Store,
		private readonly _integrationTenantService: IntegrationTenantService,
		private readonly _errorHandlingService: ErrorHandlingService,
	) {
		super(_translateService);
	}

	ngOnInit(): void {
		this._loadSmartTableSettings();
	}

	ngAfterViewInit() {
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
	 * Load Smart Table settings to configure the component.
	 */
	private _loadSmartTableSettings() {
		// Define settings for the Smart Table
		this.settingsSmartTable = {
			hideSubHeader: true,
			actions: false,
			mode: 'external',
			editable: true,
			selectedRowIndex: -1, // Initialize the selected row index
			columns: {
				name: {
					title: this.getTranslation('SM_TABLE.NAME'), // Set column title based on translation
					type: 'string' // Set column type to 'string'
				},
				lastSyncAt: {
					title: this.getTranslation('SM_TABLE.LAST_SYNC'), // Set column title based on translation
					type: 'string' // Set column type to 'string'
				},
				isActive: {
					title: this.getTranslation('SM_TABLE.STATUS'), // Set column title based on translation
					type: 'string' // Set column type to 'string'
				}
			}
		};
	}
}
