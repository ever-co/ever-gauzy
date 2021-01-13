import { IFeatureOrganization } from './feature.model';
import {
	FileStorageProviderEnum,
	S3FileStorageProviderConfig
} from './file-provider';
import { IOrganization } from './organization.model';
import { IRolePermission } from './role-permission.model';

export interface ITenant {
	id?: string;
	name?: string;

	readonly createdAt?: Date;
	readonly updatedAt?: Date;

	organizations?: IOrganization[];
	rolePermissions?: IRolePermission[];
	featureOrganizations?: IFeatureOrganization[];
}

export interface ITenantCreateInput {
	name: string;
}

export interface ITenantSetting extends S3FileStorageProviderConfig {
	fileStorageProvider?: FileStorageProviderEnum;
}
