import { IBasePerTenantAndOrganizationEntityModel, IEmployee } from '@gauzy/contracts';
import { IPlugin } from './plugin.model';
import { IPluginVersion } from './plugin-version.model';

export enum PluginInstallationStatus {
	INSTALLED = 'INSTALLED',
	UNINSTALLED = 'UNINSTALLED',
	FAILED = 'FAILED',
	IN_PROGRESS = 'IN_PROGRESS'
}
/**
 * Plugin installation record
 */
export interface IPluginInstallation extends IBasePerTenantAndOrganizationEntityModel {
	plugin: IPlugin;
	version: IPluginVersion;
	installedBy: IEmployee;
	installedAt: Date;
	uninstalledAt?: Date;
	status: PluginInstallationStatus;
}
