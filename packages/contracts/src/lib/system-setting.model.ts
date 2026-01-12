import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

/**
 * Enum representing the scope level for system settings.
 */
export enum SystemSettingScope {
	GLOBAL = 'GLOBAL',
	TENANT = 'TENANT',
	ORGANIZATION = 'ORGANIZATION'
}

/**
 * Type representing the value type of a system setting.
 */
export type SystemSettingValueType = 'string' | 'boolean' | 'number';

/**
 * Interface defining metadata for a system setting.
 * Used to define which scopes are allowed, default values, and other properties.
 */
export interface ISystemSettingMetadata {
	key: string;
	envVar?: string;
	defaultValue?: any;
	allowedScopes: SystemSettingScope[];
	isSecret?: boolean;
	type: SystemSettingValueType;
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
	value?: string | boolean | number;
	source: SystemSettingScope | 'ENV' | 'DEFAULT';
}
