import { IRelationalImageAsset } from './image-asset.model';
import { IImportRecord } from './import-export.model';
import { IFeatureOrganization } from './feature.model';
import {
	FileStorageProviderEnum,
	ICloudinaryFileStorageProviderConfig,
	IS3FileStorageProviderConfig,
	IWasabiFileStorageProviderConfig
} from './file-provider';
import { IOrganization } from './organization.model';
import { IRolePermission } from './role-permission.model';
import { IBaseEntityModel, ID } from './base-entity.model';

export interface ITenant extends IBaseEntityModel, IRelationalImageAsset {
	name?: string;
	logo?: string;
	standardWorkHoursPerDay?: number;
	/**
	 * Stripe customer this tenant bills through, on hosted deployments.
	 *
	 * Stored rather than looked up by email on each request: an email address is mutable and is not
	 * unique across Stripe customers, whereas this id is both stable and unambiguous. Null on every
	 * self-hosted install and on any tenant created before billing was configured.
	 */
	stripeCustomerId?: string;
	organizations?: IOrganization[];
	rolePermissions?: IRolePermission[];
	featureOrganizations?: IFeatureOrganization[];
	importRecords?: IImportRecord[];
}

export interface ITenantCreateInput extends ITenantUpdateInput {
	isImporting?: boolean;
	sourceId?: string;
	userSourceId?: ID;
}

export interface ITenantUpdateInput extends IRelationalImageAsset {
	name: string;
	logo?: string;
}

export interface ITenantSetting
	extends IS3FileStorageProviderConfig,
		IWasabiFileStorageProviderConfig,
		ICloudinaryFileStorageProviderConfig {
	fileStorageProvider?: FileStorageProviderEnum;
}

/**
 * The UI framework a tenant prefers for the surfaces that ship in BOTH flavours.
 *
 * Gauzy is progressively re-building pages in React next to their Angular originals; this
 * tenant-wide switch decides which flavour every user of the tenant gets. It is a global
 * preference (not per organization / user), persisted as the `preferredUi` tenant setting.
 */
export enum PreferredUiEnum {
	/** The original Angular pages (default). */
	ANGULAR = 'angular',
	/** The React re-implementations, wherever one exists. */
	REACT = 'react'
}

/** Name of the tenant setting row that stores the {@link PreferredUiEnum} choice. */
export const PREFERRED_UI_SETTING_KEY = 'preferredUi';

/** The tenant-wide UI preferences every signed-in user of the tenant may read. */
export interface ITenantUiPreferences {
	preferredUi: PreferredUiEnum;
}

/** Payload accepted when a tenant administrator changes the UI preferences. */
export interface ITenantUiPreferencesUpdateInput {
	preferredUi?: PreferredUiEnum;
}
