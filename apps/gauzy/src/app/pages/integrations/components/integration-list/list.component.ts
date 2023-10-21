import { AfterViewInit, Component, OnInit } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { EMPTY, catchError, map } from 'rxjs';
import { debounceTime, switchMap } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/common-angular';
import {ComponentLayoutStyleEnum, IIntegration, IIntegrationTenant, IOrganization, IPagination} from '@gauzy/contracts';
import { ErrorHandlingService, IntegrationTenantService, Store } from './../../../../@core/services';
import { TranslationBaseComponent } from './../../../../@shared/language-base';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-integration-list',
	templateUrl: './list.component.html',
	styleUrls: ['./list.component.scss'],
	providers: [
		TitleCasePipe
	]
})
export class IntegrationListComponent extends TranslationBaseComponent implements AfterViewInit, OnInit {

	public settingsSmartTable: object;
	public organization: IOrganization;
	public integrations$: Observable<IIntegrationTenant[]>;
	public dummyIntegrations$: Observable<any[]>;
	public disabled = true
	public selectedIntegration = null;

	constructor(
		private readonly _titlecasePipe: TitleCasePipe,
		public readonly _translateService: TranslateService,
		private readonly _store: Store,
		private readonly _integrationTenantService: IntegrationTenantService,
		private readonly _errorHandlingService: ErrorHandlingService,
	) {
		super(_translateService);
		this.dummyIntegrations$ = new Observable((observer) => {
			observer.next([ { "id": "6635d47c-f7a4-407f-9831-650e5a17e996", "createdAt": "2023-10-19T12:04:29.490Z", "updatedAt": "2023-10-19T12:04:29.490Z", "isActive": true, "isArchived": false, "tenantId": "e077012f-f040-44c8-9500-7ae5f594e136", "organizationId": "fa4eedb0-0ae5-4a93-9a0e-699ae2219449", "name": "Hubstaff", "lastSyncedAt": null, "integrationId": "5b53a1ea-b7e7-41d0-a602-3dc8d319b331", "integration": { "id": "5b53a1ea-b7e7-41d0-a602-3dc8d319b331", "createdAt": "2023-10-19T11:58:32.927Z", "updatedAt": "2023-10-19T11:58:32.927Z", "isActive": true, "isArchived": false, "name": "Hubstaff", "provider": "Hubstaff", "redirectUrl": "hubstaff", "imgSrc": "integrations\\hubstaff.svg", "isComingSoon": false, "isPaid": false, "version": null, "docUrl": null, "isFreeTrial": false, "freeTrialPeriod": null, "order": 1, "fullImgUrl": "http://localhost:3000/public/integrations/hubstaff.svg" } }, { "id": "222c8286-8d64-43f9-9074-90ae8368e917", "createdAt": "2023-10-20T11:57:16.726Z", "updatedAt": "2023-10-20T11:57:16.726Z", "isActive": true, "isArchived": false, "tenantId": "e077012f-f040-44c8-9500-7ae5f594e136", "organizationId": "fa4eedb0-0ae5-4a93-9a0e-699ae2219449", "name": "Github", "lastSyncedAt": null, "integrationId": "3b7eebd0-4319-47a9-8763-c594f4fd1524", "integration": { "id": "3b7eebd0-4319-47a9-8763-c594f4fd1524", "createdAt": "2023-10-19T11:58:32.927Z", "updatedAt": "2023-10-19T11:58:32.927Z", "isActive": true, "isArchived": false, "name": "Github", "provider": "Github", "redirectUrl": "github", "imgSrc": "integrations\\github.svg", "isComingSoon": false, "isPaid": false, "version": null, "docUrl": null, "isFreeTrial": false, "freeTrialPeriod": null, "order": 4, "fullImgUrl": "http://localhost:3000/public/integrations/github.svg" } } ]
			)
		})
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
				integration: {
					title: this.getTranslation('SM_TABLE.PROVIDER'), // Set column title based on translation
					type: 'string', // Set column type to 'string'
					valuePrepareFunction: (integration: IIntegration) => {
						// Transform the column data using '_titlecasePipe.transform' (modify this function)
						return this._titlecasePipe.transform(integration.provider);
					}
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

	public delete(): void {

	}

	public edit(): void {

	}

	public add(): void {

	}

	public selectIntegration(integration): void {
		if (
			this.selectedIntegration &&
			this.selectedIntegration === integration
		) {
			this.selectedIntegration = null;
			this.disabled = true;
			return;
		}
		this.selectedIntegration = integration;
		this.disabled = false;
	}
}
