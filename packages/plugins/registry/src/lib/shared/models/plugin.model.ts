import { IBasePerTenantAndOrganizationEntityModel, ID, IEmployee, PluginStatus, PluginType } from '@gauzy/contracts';
import { IPluginSource } from './plugin-source.model';
import { IPluginVersion, IPluginVersionUpdate } from './plugin-version.model';

export interface IPluginUpdate {
	id: ID;
	name?: string;
	description?: string;
	type?: PluginType;
	status?: PluginStatus;
	author?: string;
	license?: string;
	homepage?: string;
	repository?: string;
	version?: IPluginVersionUpdate;
}

export interface IPlugin extends IBasePerTenantAndOrganizationEntityModel {
	name: string; // Plugin name
	description?: string; // Optional description
	type: PluginType; // Type of the plugin
	status: PluginStatus; // Status of the plugin
	versions: IPluginVersion[]; // List of plugin versions
	version?: IPluginVersion; // Current version

	author?: string; // Optional author information
	license?: string; // Optional license information
	homepage?: string; // Optional homepage URL
	repository?: string; // Optional repository URL

	uploadedBy?: IEmployee; // Employee who uploaded the plugin
	uploadedById?: ID; // ID reference for the employee who uploaded the plugin
	uploadedAt?: Date; // Optional date when the plugin was uploaded

	source?: IPluginSource; // Optional reference to the plugin's source

	installed: boolean; // Flag indicating if the plugin is installed
	downloadCount: number; // Number of times the plugin has been downloaded
	lastDownloadedAt?: Date; // Optional date when the plugin was last downloaded
}
