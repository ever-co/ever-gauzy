import { IBasePerTenantAndOrganizationEntityModel, ID, IEmployee } from '@gauzy/contracts';
import { IPluginVersion } from './plugin-version.model';
import { IPlugin } from './plugin.model';

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
	plugin: IPlugin; // Installed plugin entity
	pluginId?: ID; // ID reference for the installed plugin

	version: IPluginVersion; // Installed version of the plugin
	versionId?: ID; // ID reference for the installed plugin version

	installedBy?: IEmployee; // Employee who installed the plugin
	installedById?: ID; // ID reference for the employee who installed the plugin

	installedAt?: Date; // Optional date when the plugin was installed
	uninstalledAt?: Date; // Optional date when the plugin was uninstalled

	status: PluginInstallationStatus; // Status of the plugin installation

	// Activation state for this specific installation
	isActivated?: boolean; // Whether this installation is currently activated
	activatedAt?: Date; // When this installation was last activated
	deactivatedAt?: Date; // When this installation was last deactivated
}
