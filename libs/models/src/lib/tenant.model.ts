import {
	FileStorageProviderEnum,
	S3FileStorageProviderConfig
} from './file-provider';

export interface ITenant {
	id?: string;
	name?: string;

	readonly createdAt?: Date;
	readonly updatedAt?: Date;

	// organizations?: IOrganization[];
}

export interface ITenantCreateInput {
	name: string;
}

export interface ITenantSetting extends S3FileStorageProviderConfig {
	fileStorageProvider: FileStorageProviderEnum;
}
