import { Component, OnInit } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Data, Router } from '@angular/router';
import { filter, map, tap } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IIntegrationSetting, IOrganization } from '@gauzy/contracts';
import { TranslationBaseComponent } from './../../../../../@shared/language-base';
import { Store } from './../../../../../@core/services';

enum SettingTitlesEnum {
	API_KEY = 'apiKey',
	API_SECRET = 'apiSecret',
	OPEN_AI_SECRET_KEY = 'openaiApiSecretKey'
}

@UntilDestroy({ checkProperties: true })
@Component({
	styleUrls: ['./view.component.scss'],
	templateUrl: './view.component.html',
	providers: [TitleCasePipe]
})
export class GauzyAIViewComponent extends TranslationBaseComponent implements OnInit {

	public organization$: Observable<IOrganization>; // Observable to hold the selected organization
	public settings$: Observable<IIntegrationSetting[]>;
	public settings: IIntegrationSetting[] = [];

	// Define a mapping object for setting names to titles and information
	public settingTitles: Record<string, string>[] = [
		{
			title: this.getTranslation('INTEGRATIONS.GAUZY_AI_PAGE.API_KEY'),
			information: this.getTranslation('INTEGRATIONS.GAUZY_AI_PAGE.TOOLTIP.API_KEY'),
			matching: SettingTitlesEnum.API_KEY
		},
		{
			title: this.getTranslation('INTEGRATIONS.GAUZY_AI_PAGE.API_SECRET'),
			information: this.getTranslation('INTEGRATIONS.GAUZY_AI_PAGE.TOOLTIP.API_SECRET'),
			matching: SettingTitlesEnum.API_SECRET
		},
		{
			title: this.getTranslation('INTEGRATIONS.GAUZY_AI_PAGE.OPEN_AI_SECRET_KEY'),
			information: this.getTranslation('INTEGRATIONS.GAUZY_AI_PAGE.TOOLTIP.OPEN_AI_SECRET_KEY'),
			matching: SettingTitlesEnum.OPEN_AI_SECRET_KEY
		}
	];

	constructor(
		private readonly _router: Router,
		private readonly _activatedRoute: ActivatedRoute,
		public readonly translateService: TranslateService,
		private readonly _store: Store
	) {
		super(translateService);
	}

	ngOnInit(): void {
		// Setting up the organization$ observable pipeline
		this.organization$ = this._store.selectedOrganization$.pipe(
			// Exclude falsy values from the emitted values
			filter((organization: IOrganization) => !!organization),
			// Handle component lifecycle to avoid memory leaks
			untilDestroyed(this)
		);

		// Setting up the settings$ observable pipeline
		this.settings$ = this._activatedRoute.data.pipe(
			map(({ settings }: Data) => settings),
			// Update component state with fetched settings
			tap((settings: IIntegrationSetting[]) => {
				this.settings = settings;
			}),
			// Handle component lifecycle to avoid memory leaks
			untilDestroyed(this)
		);
	}

	/**
	 * Gets the title for a given integration setting.
	 *
	 * @param setting - The integration setting for which to retrieve the title.
	 * @returns The title for the integration setting, or the original setting name if not found.
	 */
	getTitleForSetting(setting: IIntegrationSetting): string {
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
	getTooltipForSetting(setting: IIntegrationSetting): string {
		// Find the key configuration that matches the setting name
		const keyConfig = this.settingTitles.find((key) => key.matching === setting.settingsName);

		// If a key configuration is found, return its information; otherwise, return an empty string
		return keyConfig?.information || '';
	}

	/**
	 * Navigate to the "Integrations" page.
	 */
	navigateToIntegrations(): void {
		this._router.navigate(['/pages/integrations']);
	}

	/**
	 * Navigates to the 'Reset Integration' route within the GitHub integration setup wizard.
	 */
	navigateToResetIntegration(): void {
		this._router.navigate(['/pages/integrations/gauzy-ai/reset']);
	}
}
