import { IImportRecord } from 'import-export.model';
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
	importRecords?: IImportRecord[];
}

export interface ITenantCreateInput {
	name: string;
	
	isImporting?: boolean;
	sourceId?: string;
	userSourceId?: string;
}

export interface ITenantSetting extends S3FileStorageProviderConfig {
	fileStorageProvider?: FileStorageProviderEnum;
}
