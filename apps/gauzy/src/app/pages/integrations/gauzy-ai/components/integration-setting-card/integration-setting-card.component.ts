import { Component, Input } from "@angular/core";
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { IIntegrationSetting } from "@gauzy/contracts";
import { IntegrationSettingService } from "../../../../../@core/services";
import { TranslationBaseComponent } from "../../../../../@shared/language-base";

export enum SettingTitlesEnum {
    API_KEY = 'apiKey',
    API_SECRET = 'apiSecret',
    OPEN_AI_API_SECRET_KEY = 'openAiSecretKey',
    OPEN_AI_ORGANIZATION_ID = 'openAiOrganizationId'
}

@Component({
    selector: 'ngx-integration-setting-card',
    styleUrls: ['./integration-setting-card.component.scss'],
    templateUrl: './integration-setting-card.component.html',
})
export class IntegrationSettingCardComponent extends TranslationBaseComponent {

    public isIntegrationAISettingsEdit: boolean = false;

    // Define a mapping object for setting names to titles and information
    public settingTitles: Record<string, string>[] = [
        {
            settingTitle: this.getTranslation('INTEGRATIONS.GAUZY_AI_PAGE.API_KEY'),
            settingMatching: SettingTitlesEnum.API_KEY,
            settingInformation: this.getTranslation('INTEGRATIONS.GAUZY_AI_PAGE.TOOLTIP.API_KEY')
        },
        {
            settingTitle: this.getTranslation('INTEGRATIONS.GAUZY_AI_PAGE.API_SECRET'),
            settingMatching: SettingTitlesEnum.API_SECRET,
            settingInformation: this.getTranslation('INTEGRATIONS.GAUZY_AI_PAGE.TOOLTIP.API_SECRET')
        },
        {
            settingTitle: this.getTranslation('INTEGRATIONS.GAUZY_AI_PAGE.OPEN_AI_API_SECRET_KEY'),
            settingMatching: SettingTitlesEnum.OPEN_AI_API_SECRET_KEY,
            settingInformation: this.getTranslation('INTEGRATIONS.GAUZY_AI_PAGE.TOOLTIP.OPEN_AI_API_SECRET_KEY')
        },
        {
            settingTitle: this.getTranslation('INTEGRATIONS.GAUZY_AI_PAGE.OPEN_AI_ORGANIZATION_ID'),
            settingMatching: SettingTitlesEnum.OPEN_AI_ORGANIZATION_ID,
            settingInformation: this.getTranslation('INTEGRATIONS.GAUZY_AI_PAGE.TOOLTIP.OPEN_AI_ORGANIZATION_ID')
        }
    ];

    @Input() title: string;
    @Input() items: IIntegrationSetting[] = []; // Adjust the type accordingly

    constructor(
        public readonly translateService: TranslateService,
        private readonly _integrationSettingService: IntegrationSettingService,
    ) {
        super(translateService);
    }

    /**
     * Gets the title for a given integration setting.
     *
     * @param setting - The integration setting for which to retrieve the title.
     * @returns The title for the integration setting, or the original setting name if not found.
     */
    public getTitleForSetting(setting: IIntegrationSetting): string {
        // Find the key configuration that matches the setting name
        const keyConfig = this.settingTitles.find((key) => key.settingMatching === setting.settingsName);

        // If a key configuration is found, return its title; otherwise, return the original setting name
        return keyConfig?.settingTitle || setting.settingsName;
    }

    /**
     * Gets the tooltip content for a given integration setting.
     *
     * @param setting - The integration setting for which to retrieve the tooltip content.
     * @returns The tooltip content for the integration setting, or an empty string if not found.
     */
    public getTooltipForSetting(setting: IIntegrationSetting): string {
        // Find the key configuration that matches the setting name
        const keyConfig = this.settingTitles.find((key) => key.settingMatching === setting.settingsName);

        // If a key configuration is found, return its information; otherwise, return an empty string
        return keyConfig?.settingInformation || '';
    }

    /**
     * Save settings.
     */
    async saveSettings(): Promise<void> {
        const settings: IIntegrationSetting[] = this.items;

        // Use Promise.all to wait for all update operations to complete
        await Promise.all(settings.map(async (setting: IIntegrationSetting) => {
            await firstValueFrom(
                this._integrationSettingService.update(
                    setting.id,
                    this._mapIntegrationSettingPayload(setting)
                )
            );
        }));
    }

    /**
     * Map integration setting payload data to the required format.
     *
     * @param setting - An integration setting object.
     * @returns Mapped integration setting payload data.
     */
    private _mapIntegrationSettingPayload(setting: IIntegrationSetting): Partial<IIntegrationSetting> {
        return ({
            settingsName: setting['settingsName'],
            settingsValue: setting['newSettingsValue'],
            organizationId: setting['organizationId'],
            tenantId: setting['tenantId'],
        });
    }
}
