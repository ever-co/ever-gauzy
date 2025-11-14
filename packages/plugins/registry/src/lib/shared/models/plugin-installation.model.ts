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

	// Business Logic Methods
	isInstalled(): boolean;
	isFailed(): boolean;
	isInProgress(): boolean;
	isUninstalled(): boolean;
	isCurrentlyActive(): boolean;
	activate(): void;
	deactivate(): void;
	markAsInstalled(): void;
	markAsFailed(): void;
	markAsUninstalled(): void;
	getInstallationDuration(): number | undefined;
	getActiveTime(): number;
	wasInstalledBy(employeeId: string): boolean;
	canBeActivated(): boolean;
	canBeDeactivated(): boolean;
	canBeUninstalled(): boolean;
	validate(): { isValid: boolean; errors: string[] };
}

/**
 * Static methods interface for PluginInstallation class
 */
export interface IPluginInstallationStatic {
	create(data: Partial<IPluginInstallation>): IPluginInstallation;
	createForPluginVersion(pluginId: string, versionId: string, installedById?: string): IPluginInstallation;
	isValidStatus(status: string): status is PluginInstallationStatus;
	getAvailableStatuses(): PluginInstallationStatus[];
	filterByStatus(installations: IPluginInstallation[], status: PluginInstallationStatus): IPluginInstallation[];
	filterInstalled(installations: IPluginInstallation[]): IPluginInstallation[];
	filterFailed(installations: IPluginInstallation[]): IPluginInstallation[];
	filterInProgress(installations: IPluginInstallation[]): IPluginInstallation[];
	filterUninstalled(installations: IPluginInstallation[]): IPluginInstallation[];
	filterActive(installations: IPluginInstallation[]): IPluginInstallation[];
	filterByPlugin(installations: IPluginInstallation[], pluginId: string): IPluginInstallation[];
	filterByInstaller(installations: IPluginInstallation[], installedById: string): IPluginInstallation[];
	sortByInstallDate(installations: IPluginInstallation[]): IPluginInstallation[];
	sortByCreationDate(installations: IPluginInstallation[]): IPluginInstallation[];
	findLatestForPlugin(installations: IPluginInstallation[], pluginId: string): IPluginInstallation | undefined;
	isPluginInstalledByUser(installations: IPluginInstallation[], pluginId: string, installedById: string): boolean;
	groupByStatus(installations: IPluginInstallation[]): Record<PluginInstallationStatus, IPluginInstallation[]>;
	groupByPlugin(installations: IPluginInstallation[]): Record<string, IPluginInstallation[]>;
	calculateAverageInstallTime(installations: IPluginInstallation[]): number | undefined;
	getStatistics(installations: IPluginInstallation[]): {
		total: number;
		byStatus: Record<PluginInstallationStatus, number>;
		active: number;
		successRate: number;
		averageInstallTime?: number;
	};
}
