import { IBasePerTenantAndOrganizationEntityModel } from "./base-entity.model";
import { IRelationalIntegrationTenant } from "./integration.model";

export interface IIntegrationSetting extends IBasePerTenantAndOrganizationEntityModel, IRelationalIntegrationTenant {
    settingsName: string;
    settingsValue: string;
}

export interface IIntegrationSettingUpdateInput extends Pick<IIntegrationSetting, 'settingsValue' | 'organizationId'> { }
