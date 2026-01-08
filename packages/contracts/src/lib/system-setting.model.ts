import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

/**
 * Enum representing the scope level for system settings.
 */
export enum SystemSettingScope {
	GLOBAL = 'GLOBAL',
	TENANT = 'TENANT',
	ORGANIZATION = 'ORGANIZATION'
}

export interface ISystemSetting extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	value?: string;
}

export interface ISystemSettingCreateInput extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	value?: string;
}

export interface ISystemSettingUpdateInput extends Partial<ISystemSettingCreateInput> {}

export interface ISystemSettingFindInput extends IBasePerTenantAndOrganizationEntityModel {
	names?: string[];
	scope?: SystemSettingScope;
}

export interface IResolvedSystemSetting {
	name: string;
	value?: string;
	source: SystemSettingScope | 'ENV' | 'DEFAULT';
}
