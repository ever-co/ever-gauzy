import { Component, OnInit } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Data, Router } from '@angular/router';
import { filter, map, tap } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IIntegrationEntitySetting, IIntegrationSetting, IOrganization, IntegrationEntity } from '@gauzy/contracts';
import { TranslationBaseComponent } from './../../../../../@shared/language-base';
import { IntegrationEntitySettingService, Store } from './../../../../../@core/services';

enum SettingTitlesEnum {
	API_KEY = 'apiKey',
	API_SECRET = 'apiSecret',
	OPEN_AI_API_SECRET_KEY = 'openAiApiSecretKey',
	OPEN_AI_ORGANIZATION_ID = 'openAiOrganizationId'
}

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

	// Define a mapping object for setting names to titles and information
	public settingTitles: Record<string, string>[] = [
		{
			title: this.getTranslation('INTEGRATIONS.GAUZY_AI_PAGE.API_KEY'),
			matching: SettingTitlesEnum.API_KEY,
			information: this.getTranslation('INTEGRATIONS.GAUZY_AI_PAGE.TOOLTIP.API_KEY')
		},
		{
			title: this.getTranslation('INTEGRATIONS.GAUZY_AI_PAGE.API_SECRET'),
			matching: SettingTitlesEnum.API_SECRET,
			information: this.getTranslation('INTEGRATIONS.GAUZY_AI_PAGE.TOOLTIP.API_SECRET')
		},
		{
			title: this.getTranslation('INTEGRATIONS.GAUZY_AI_PAGE.OPEN_AI_API_SECRET_KEY'),
			matching: SettingTitlesEnum.OPEN_AI_API_SECRET_KEY,
			information: this.getTranslation('INTEGRATIONS.GAUZY_AI_PAGE.TOOLTIP.OPEN_AI_API_SECRET_KEY')
		},
		{
			title: this.getTranslation('INTEGRATIONS.GAUZY_AI_PAGE.OPEN_AI_ORGANIZATION_ID'),
			matching: SettingTitlesEnum.OPEN_AI_ORGANIZATION_ID,
			information: this.getTranslation('INTEGRATIONS.GAUZY_AI_PAGE.TOOLTIP.OPEN_AI_ORGANIZATION_ID')
		}
	];

	constructor(
		private readonly _router: Router,
		private readonly _activatedRoute: ActivatedRoute,
		public readonly translateService: TranslateService,
		private readonly _store: Store,
		private readonly _integrationEntitySettingService: IntegrationEntitySettingService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		// Setting up the organization$ observable pipeline
		this.organization$ = this._store.selectedOrganization$.pipe(
			// Exclude falsy values from the emitted values
			filter((organization: IOrganization) => !!organization),
			// Tap operator for side effects - setting the organization property
			tap((organization: IOrganization) => this.organization = organization),
			// Handle component lifecycle to avoid memory leaks
			untilDestroyed(this)
		);

		// Filter only API_KEY and API_SECRET
		const settingsFilters = [SettingTitlesEnum.API_KEY, SettingTitlesEnum.API_SECRET];
		this.settings$ = this.getFilteredSettings$(settingsFilters);

		// Filter only OPEN_AI_API_SECRET_KEY and OPEN_AI_ORGANIZATION_ID
		const openAISettingsFilters = [SettingTitlesEnum.OPEN_AI_API_SECRET_KEY, SettingTitlesEnum.OPEN_AI_ORGANIZATION_ID];
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
		this._activatedRoute.data.pipe(
			// Extracting the 'entitySettings' property from the 'integration_tenant' object in the route's data
			map(({ entitySettings }: Data) => entitySettings),
			// Finding the entity setting related to the specified entity type
			map((entitySettings: IIntegrationEntitySetting[]) =>
				entitySettings.find((setting) => setting.entity === entityType) || defaultEntitySetting
			),
			// Updating the specified component property with the fetched entity setting
			tap((entity: IIntegrationEntitySetting) => this[propertyName] = entity),
			// Handling the component lifecycle to avoid memory leaks
			untilDestroyed(this)
		).subscribe();
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
		const update$ = this._integrationEntitySettingService.updateEntitySettings(integrationId, {
			...entity,
			integrationId,
			tenantId,
			organizationId,
			sync
		}).pipe(
			tap(([updatedSetting]) => {
				switch (updatedSetting.entity) {
					case IntegrationEntity.JOB_MATCHING:
						this.jobSearchMatchingSync = updatedSetting;
						break;
					case IntegrationEntity.EMPLOYEE_PERFORMANCE:
						this.employeePerformanceAnalysisSync = updatedSetting;
						break;
				}
			}),
			// Handling the component lifecycle to avoid memory leaks
			untilDestroyed(this)
		);
		// Subscribe to the observable returned by the updateEntitySettings method
		update$.subscribe();
	}


	/**
	 * Gets the title for a given integration setting.
	 *
	 * @param setting - The integration setting for which to retrieve the title.
	 * @returns The title for the integration setting, or the original setting name if not found.
	 */
	public getTitleForSetting(setting: IIntegrationSetting): string {
		// Find the key configuration that matches the setting name
		const keyConfig = this.settingTitles.find((key) => key.matching === setting.settingsName);

		// If a key configuration is found, return its title; otherwise, return the original setting name
		return keyConfig?.title || setting.settingsName;
	}

	/**
	 * Gets the tooltip content for a given integration setting.
	 *
	 * @param setting - The integration setting for which to retrieve the tooltip content.
	 * @returns The tooltip content for the integration setting, or an empty string if not found.
	 */
	public getTooltipForSetting(setting: IIntegrationSetting): string {
		// Find the key configuration that matches the setting name
		const keyConfig = this.settingTitles.find((key) => key.matching === setting.settingsName);

		// If a key configuration is found, return its information; otherwise, return an empty string
		return keyConfig?.information || '';
	}

	/**
	 * Navigate to the "Integrations" page.
	 */
	public navigateToIntegrations(): void {
		this._router.navigate(['/pages/integrations']);
	}

	/**
	 * Navigates to the 'Reset Integration' route within the GitHub integration setup wizard.
	 */
	public navigateToResetIntegration(): void {
		this._router.navigate(['/pages/integrations/gauzy-ai/reset']);
	}
}
