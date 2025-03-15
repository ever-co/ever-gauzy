import { IBasePerTenantAndOrganizationEntityModel, ID } from '@gauzy/contracts';
import { IPlugin } from './plugin.model';

export interface IPluginVersion extends IBasePerTenantAndOrganizationEntityModel {
	number: string; // SemVer formatted string
	changelog: string; // Description of changes in the version
	releaseDate?: Date; // Optional ISO 8601 formatted date
	downloadCount?: number; // Optional, defaults to 0
	plugin?: IPlugin; // Associated plugin entity
	pluginId?: ID; // Optional ID of the associated plugin

	// Security and integrity
	checksum?: string; // Verification hash
	signature?: string; // Digital signature for verification
}
