import { Component, OnInit } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Data } from '@angular/router';
import { EMPTY } from 'rxjs';
import { catchError, filter, map, tap } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	HttpStatus,
	IIntegrationEntitySetting,
	IIntegrationSetting,
	IIntegrationTenant,
	IOrganization,
	IntegrationEntity
} from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/i18n';
import { ReplacePipe } from '@gauzy/ui-sdk/shared';
import { ErrorHandlingService, ToastrService } from '@gauzy/ui-sdk/core';
import { Store } from '@gauzy/ui-sdk/common';
import {
	GauzyAIService,
	IntegrationEntitySettingService,
	IntegrationEntitySettingServiceStoreService
} from '@gauzy/ui-sdk/core';
import { SettingTitlesEnum } from '../integration-setting-card/integration-setting-card.component';

@UntilDestroy({ checkProperties: true })
@Component({
	styleUrls: ['./view.component.scss'],
	templateUrl: './view.component.html',
	providers: [TitleCasePipe]
})
export class GauzyAIViewComponent extends TranslationBaseComponent implements OnInit {
	public organization: IOrganization;
	public organization$: Observable<IOrganization>; // Observable to hold the selected organization
	public settings$: Observable<IIntegrationSetting[]>;
	public openAISettings$: Observable<IIntegrationSetting[]>;
	public jobSearchMatchingSync: IIntegrationEntitySetting;
	public employeePerformanceAnalysisSync: IIntegrationEntitySetting;
	public isOpenAISettingsEdit: boolean = false;
	public isIntegrationAISettingsEdit: boolean = false;

	constructor(
		private readonly _activatedRoute: ActivatedRoute,
		public readonly translateService: TranslateService,
		private readonly _replacePipe: ReplacePipe,
		private readonly _store: Store,
		private readonly _toastrService: ToastrService,
		private readonly _integrationEntitySettingService: IntegrationEntitySettingService,
		private readonly _integrationEntitySettingServiceStoreService: IntegrationEntitySettingServiceStoreService,
		private readonly _gauzyAIService: GauzyAIService,
		private readonly _errorHandlingService: ErrorHandlingService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		// Setting up the organization$ observable pipeline
		this.organization$ = this._store.selectedOrganization$.pipe(
			// Exclude falsy values from the emitted values
			filter((organization: IOrganization) => !!organization),
			// Tap operator for side effects - setting the organization property
			tap((organization: IOrganization) => (this.organization = organization)),
			// Handle component lifecycle to avoid memory leaks
			untilDestroyed(this)
		);

		// Filter only API_KEY and API_SECRET
		const settingsFilters = [SettingTitlesEnum.API_KEY, SettingTitlesEnum.API_SECRET];
		this.settings$ = this.getFilteredSettings$(settingsFilters);

		// Filter only OPEN_AI_API_SECRET_KEY and OPEN_AI_ORGANIZATION_ID
		const openAISettingsFilters = [
			SettingTitlesEnum.OPEN_AI_API_SECRET_KEY,
			SettingTitlesEnum.OPEN_AI_ORGANIZATION_ID
		];
		this.openAISettings$ = this.getFilteredSettings$(openAISettingsFilters);

		// Creating the jobSearchMatchingSync pipeline
		this.setupEntitySync(IntegrationEntity.JOB_MATCHING, 'jobSearchMatchingSync', {
			entity: IntegrationEntity.JOB_MATCHING,
			sync: false
		});

		// Creating the employeePerformanceAnalysisSync pipeline
		this.setupEntitySync(IntegrationEntity.EMPLOYEE_PERFORMANCE, 'employeePerformanceAnalysisSync', {
			entity: IntegrationEntity.EMPLOYEE_PERFORMANCE,
			sync: false
		});
	}

	/**
	 * Retrieves filtered integration settings based on specified conditions.
	 *
	 * @param filters - An array of SettingTitlesEnum values used to filter settings.
	 * @returns An Observable emitting an array of IIntegrationSetting objects that match the specified filters.
	 */
	private getFilteredSettings$(filters: SettingTitlesEnum[]): Observable<IIntegrationSetting[]> {
		return this._activatedRoute.data.pipe(
			// Extracting the 'settings' property from the 'integration_tenant' object in the route's data
			map(({ settings }: Data) => settings),
			// Filtering settings based on specified conditions using filters
			map((settings: IIntegrationSetting[]) =>
				settings.filter((setting) => filters.includes(setting.settingsName as SettingTitlesEnum))
			),
			// Handling the component lifecycle to avoid memory leaks
			untilDestroyed(this)
		);
	}

	/**
	 * Sets up an observable pipeline to fetch and handle an integration entity setting.
	 *
	 * @param entityType - The type of integration entity to fetch (e.g., JOB_MATCHING, EMPLOYEE_PERFORMANCE).
	 * @param propertyName - The name of the property where the fetched entity setting will be stored in the component.
	 * @param defaultEntitySetting - The default setting to use if no setting is found.
	 */
	private setupEntitySync(
		entityType: IntegrationEntity,
		propertyName: string,
		defaultEntitySetting: IIntegrationEntitySetting
	): void {
		// Creating the observable pipeline
		this._activatedRoute.data
			.pipe(
				// Extracting the 'entitySettings' property from the 'integration_tenant' object in the route's data
				map(({ entitySettings }: Data) => entitySettings),
				// Finding the entity setting related to the specified entity type
				map(
					(entitySettings: IIntegrationEntitySetting[]) =>
						entitySettings.find((setting) => setting.entity === entityType) || defaultEntitySetting
				),
				// Updating the specified component property with the fetched entity setting
				tap((entity: IIntegrationEntitySetting) => (this[propertyName] = entity)),
				tap(() => {
					if (entityType === IntegrationEntity.JOB_MATCHING) {
						this._integrationEntitySettingServiceStoreService.setJobMatchingEntity(
							this.jobSearchMatchingSync
						);
					}
				}),
				// Handling the component lifecycle to avoid memory leaks
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Toggles the synchronization state for a specific integration entity.
	 *
	 * @param sync - A boolean value indicating whether the synchronization should be enabled (true) or disabled (false).
	 * @param entity - An IIntegrationEntitySetting object representing the integration entity for which to toggle the synchronization state.
	 */
	public toggleIntegrationEntitySync(sync: boolean, entity: IIntegrationEntitySetting) {
		// Get the integrationId from the current route snapshot
		const integrationId = this._activatedRoute.snapshot.paramMap.get('id');
		// Destructure organization properties from the organization object
		const { tenantId, id: organizationId } = this.organization;

		// Call the updateEntitySettings method of the integration entity service
		const update$ = this._integrationEntitySettingService
			.updateEntitySettings(integrationId, {
				...entity,
				integrationId,
				tenantId,
				organizationId,
				sync
			})
			.pipe(
				tap(([updatedSetting]) => {
					let messageKey: string;
					let successMessageKey: string;

					switch (updatedSetting.entity) {
						case IntegrationEntity.JOB_MATCHING:
							this.jobSearchMatchingSync = updatedSetting;
							this.setJobMatchingEntity(this.jobSearchMatchingSync);
							messageKey = 'JOBS_SEARCH_MATCHING';
							break;
						case IntegrationEntity.EMPLOYEE_PERFORMANCE:
							this.employeePerformanceAnalysisSync = updatedSetting;
							messageKey = 'EMPLOYEE_PERFORMANCE';
							break;
					}

					// Display a success toast message using the _toastrService.
					if (messageKey) {
						successMessageKey = `INTEGRATIONS.GAUZY_AI_PAGE.MESSAGE.${messageKey}_${
							sync ? 'ENABLED' : 'DISABLED'
						}`;
						this._toastrService.success(
							this.getTranslation(successMessageKey),
							this.getTranslation('TOASTR.TITLE.SUCCESS')
						);
					}
				}),
				// Handling the component lifecycle to avoid memory leaks
				untilDestroyed(this)
			);

		// Subscribe to the observable returned by the updateEntitySettings method
		update$.subscribe();
	}

	/**
	 * Updates the job matching entity state in the IntegrationEntitySettingServiceStoreService.
	 * This function is responsible for setting the current job matching entity state
	 * based on the provided synchronization value.
	 *
	 * @param jobSearchMatchingSync - A boolean value indicating whether job search matching is synchronized. This value is used to update the job matching entity state.
	 */
	setJobMatchingEntity(jobSearchMatchingSync: IIntegrationEntitySetting): void {
		this._integrationEntitySettingServiceStoreService.setJobMatchingEntity(jobSearchMatchingSync);
	}

	/**
	 * Update integration settings.
	 *
	 * @param {IIntegrationSetting[]} settings - The integration settings to update.
	 */
	updateIntegrationSettings() {
		// Get the integrationId from the current route snapshot
		const integrationId = this._activatedRoute.snapshot.paramMap.get('id');

		this._gauzyAIService
			.update(integrationId, {})
			.pipe(
				tap((response: any) => {
					if (response['status'] == HttpStatus.BAD_REQUEST) {
						throw new Error(`${response['message']}`);
					}
				}),
				// Perform actions after the integration creation
				tap((integration: IIntegrationTenant) => {
					if (!!integration) {
						// Transform integration name for display
						const provider = this._replacePipe.transform(integration?.name, '_', ' ');
						// Display success message
						this._toastrService.success(`INTEGRATIONS.MESSAGE.SETTINGS_UPDATED`, {
							provider
						});
					}
				}),
				// Catch and handle errors
				catchError((error) => {
					// Handle and log errors using the _errorHandlingService
					this._errorHandlingService.handleError(error);
					// Return an empty observable to continue the stream
					return EMPTY;
				}),
				// Unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}
}
