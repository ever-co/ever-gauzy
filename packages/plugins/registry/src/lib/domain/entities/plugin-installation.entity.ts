import { isPostgres } from '@gauzy/config';
import { ID, IEmployee, PluginInstallationStatus } from '@gauzy/contracts';
import {
	ColumnIndex,
	Employee,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, ValidateIf } from 'class-validator';
import { Index, JoinColumn, RelationId } from 'typeorm';
import { IPluginInstallation } from '../../shared/models/plugin-installation.model';
import { IPluginVersion } from '../../shared/models/plugin-version.model';
import { IPlugin } from '../../shared/models/plugin.model';
import { MikroOrmPluginInstallationRepository } from '../repositories/mikro-orm-plugin-installation.repository';
import { PluginVersion } from './plugin-version.entity';
import { Plugin } from './plugin.entity';

@MultiORMEntity('plugin_installations', { mikroOrmRepository: () => MikroOrmPluginInstallationRepository })
@Index(['pluginId', 'tenantId', 'organizationId', 'installedById'], { unique: true })
@Index(['installedById', 'pluginId'])
export class PluginInstallation extends TenantOrganizationBaseEntity implements IPluginInstallation {
	@ApiProperty({ type: () => Plugin, description: 'Installed the plugin' })
	@MultiORMManyToOne(() => Plugin, { onDelete: 'CASCADE' })
	plugin: IPlugin;

	@RelationId((installation: PluginInstallation) => installation.plugin)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true, ...(!isPostgres() && { length: 36 }) })
	pluginId?: ID;

	@ApiProperty({ type: () => PluginVersion, description: 'Installed version of the plugin' })
	@MultiORMManyToOne(() => PluginVersion, (version: PluginVersion) => version.installations, { onDelete: 'SET NULL' })
	@JoinColumn()
	version: IPluginVersion;

	@RelationId((installation: PluginInstallation) => installation.version)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true, ...(!isPostgres() && { length: 36 }) })
	versionId?: ID;

	@ApiProperty({ type: () => Employee, description: 'Employee who installed the plugin', required: false })
	@MultiORMManyToOne(() => Employee, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn()
	installedBy: IEmployee;

	@RelationId((installation: PluginInstallation) => installation.installedBy)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true, ...(!isPostgres() && { length: 36 }) })
	installedById?: ID;

	@ApiPropertyOptional({ type: () => String, description: 'Installed date' })
	@IsOptional()
	@IsDateString({}, { message: 'InstalledAt date must be a valid ISO 8601 date string' })
	@ValidateIf((o) => o.installedAt && o.installedAt <= new Date())
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	installedAt: Date;

	@ApiPropertyOptional({ type: () => String, description: 'Uninstalled date' })
	@IsOptional()
	@IsDateString({}, { message: 'UninstalledAt date must be a valid ISO 8601 date string' })
	@ValidateIf((o) => o.uninstalledAt && o.uninstalledAt <= new Date())
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	uninstalledAt?: Date;

	@MultiORMColumn({
		type: 'simple-enum',
		enum: PluginInstallationStatus,
		default: PluginInstallationStatus.IN_PROGRESS
	})
	@ApiProperty({ enum: PluginInstallationStatus, description: 'Plugin installation status' })
	@IsNotEmpty({ message: 'Plugin installation status is required' })
	status: PluginInstallationStatus;

	@ApiPropertyOptional({
		type: Boolean,
		description: 'Whether this installation is currently activated',
		default: false
	})
	@IsOptional()
	@IsBoolean({ message: 'IsActivated must be a boolean' })
	@MultiORMColumn({ default: false })
	isActivated?: boolean;

	@ApiPropertyOptional({ type: Date, description: 'When this installation was last activated' })
	@IsOptional()
	@IsDateString({}, { message: 'ActivatedAt date must be a valid ISO 8601 date string' })
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	activatedAt?: Date;

	@ApiPropertyOptional({ type: Date, description: 'When this installation was last deactivated' })
	@IsOptional()
	@IsDateString({}, { message: 'DeactivatedAt date must be a valid ISO 8601 date string' })
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	deactivatedAt?: Date;

	// Business Logic Methods

	/**
	 * Check if the installation is currently installed
	 */
	public isInstalled(): boolean {
		return this.status === PluginInstallationStatus.INSTALLED;
	}

	/**
	 * Check if the installation failed
	 */
	public isFailed(): boolean {
		return this.status === PluginInstallationStatus.FAILED;
	}

	/**
	 * Check if the installation is in progress
	 */
	public isInProgress(): boolean {
		return this.status === PluginInstallationStatus.IN_PROGRESS;
	}

	/**
	 * Check if the installation has been uninstalled
	 */
	public isUninstalled(): boolean {
		return this.status === PluginInstallationStatus.UNINSTALLED;
	}

	/**
	 * Check if the installation is currently active
	 */
	public isCurrentlyActive(): boolean {
		return this.isInstalled() && this.isActivated === true;
	}

	/**
	 * Activate the plugin installation
	 */
	public activate(): void {
		if (!this.isInstalled()) {
			throw new Error('Cannot activate a plugin that is not installed');
		}

		this.isActivated = true;
		this.activatedAt = new Date();
		this.deactivatedAt = undefined; // Clear deactivation timestamp
	}

	/**
	 * Deactivate the plugin installation
	 */
	public deactivate(): void {
		this.isActivated = false;
		this.deactivatedAt = new Date();
	}

	/**
	 * Mark installation as completed successfully
	 */
	public markAsInstalled(): void {
		this.status = PluginInstallationStatus.INSTALLED;
		this.installedAt = new Date();
	}

	/**
	 * Mark installation as failed
	 */
	public markAsFailed(): void {
		this.status = PluginInstallationStatus.FAILED;
		this.isActivated = false;
	}

	/**
	 * Mark installation as uninstalled
	 */
	public markAsUninstalled(): void {
		this.status = PluginInstallationStatus.UNINSTALLED;
		this.uninstalledAt = new Date();
		this.isActivated = false;
		this.deactivatedAt = new Date();
	}

	/**
	 * Get installation duration in milliseconds
	 */
	public getInstallationDuration(): number | undefined {
		if (!this.installedAt || !this.createdAt) {
			return undefined;
		}

		return new Date(this.installedAt).getTime() - new Date(this.createdAt).getTime();
	}

	/**
	 * Get how long the plugin has been active (in milliseconds)
	 */
	public getActiveTime(): number {
		if (!this.activatedAt) {
			return 0;
		}

		const endTime = this.deactivatedAt ? new Date(this.deactivatedAt).getTime() : new Date().getTime();
		return endTime - new Date(this.activatedAt).getTime();
	}

	/**
	 * Check if installation was performed by a specific user
	 */
	public wasInstalledBy(employeeId: ID): boolean {
		return this.installedById === employeeId;
	}

	/**
	 * Check if the installation can be activated
	 */
	public canBeActivated(): boolean {
		return this.isInstalled() && this.isActivated !== true;
	}

	/**
	 * Check if the installation can be deactivated
	 */
	public canBeDeactivated(): boolean {
		return this.isCurrentlyActive();
	}

	/**
	 * Check if the installation can be uninstalled
	 */
	public canBeUninstalled(): boolean {
		return this.isInstalled() || this.isFailed();
	}

	/**
	 * Validate installation data integrity
	 */
	public validate(): { isValid: boolean; errors: string[] } {
		const errors: string[] = [];

		if (!this.plugin && !this.pluginId) {
			errors.push('Plugin reference is required');
		}

		if (!this.version && !this.versionId) {
			errors.push('Version reference is required');
		}

		if (!this.status) {
			errors.push('Installation status is required');
		}

		if (this.isActivated === true && !this.activatedAt) {
			errors.push('Activated installation must have activatedAt timestamp');
		}

		if (this.uninstalledAt && !this.installedAt) {
			errors.push('Cannot have uninstall date without install date');
		}

		if (this.uninstalledAt && this.installedAt && new Date(this.uninstalledAt) < new Date(this.installedAt)) {
			errors.push('Uninstall date cannot be before install date');
		}

		return {
			isValid: errors.length === 0,
			errors
		};
	}

	// Static Methods

	/**
	 * Create a new plugin installation instance
	 */
	public static create(data: Partial<PluginInstallation>): PluginInstallation {
		const installation = new PluginInstallation();
		Object.assign(installation, {
			status: PluginInstallationStatus.IN_PROGRESS,
			isActivated: false,
			...data
		});
		return installation;
	}

	/**
	 * Create an installation for a plugin and version
	 */
	public static createForPluginVersion(
		pluginId: string,
		versionId: string,
		installedById?: string
	): PluginInstallation {
		return this.create({
			pluginId,
			versionId,
			installedById,
			status: PluginInstallationStatus.IN_PROGRESS
		});
	}

	/**
	 * Validate installation status
	 */
	public static isValidStatus(status: string): status is PluginInstallationStatus {
		return Object.values(PluginInstallationStatus).includes(status as PluginInstallationStatus);
	}

	/**
	 * Get all available installation statuses
	 */
	public static getAvailableStatuses(): PluginInstallationStatus[] {
		return Object.values(PluginInstallationStatus);
	}

	/**
	 * Filter installations by status
	 */
	public static filterByStatus(
		installations: PluginInstallation[],
		status: PluginInstallationStatus
	): PluginInstallation[] {
		return installations.filter((installation) => installation.status === status);
	}

	/**
	 * Get installed plugins only
	 */
	public static filterInstalled(installations: PluginInstallation[]): PluginInstallation[] {
		return this.filterByStatus(installations, PluginInstallationStatus.INSTALLED);
	}

	/**
	 * Get failed installations only
	 */
	public static filterFailed(installations: PluginInstallation[]): PluginInstallation[] {
		return this.filterByStatus(installations, PluginInstallationStatus.FAILED);
	}

	/**
	 * Get in-progress installations only
	 */
	public static filterInProgress(installations: PluginInstallation[]): PluginInstallation[] {
		return this.filterByStatus(installations, PluginInstallationStatus.IN_PROGRESS);
	}

	/**
	 * Get uninstalled plugins only
	 */
	public static filterUninstalled(installations: PluginInstallation[]): PluginInstallation[] {
		return this.filterByStatus(installations, PluginInstallationStatus.UNINSTALLED);
	}

	/**
	 * Filter active installations (installed and activated)
	 */
	public static filterActive(installations: PluginInstallation[]): PluginInstallation[] {
		return installations.filter((installation) => installation.isCurrentlyActive());
	}

	/**
	 * Filter installations by plugin
	 */
	public static filterByPlugin(installations: PluginInstallation[], pluginId: string): PluginInstallation[] {
		return installations.filter((installation) => installation.pluginId === pluginId);
	}

	/**
	 * Filter installations by user
	 */
	public static filterByInstaller(installations: PluginInstallation[], installedById: string): PluginInstallation[] {
		return installations.filter((installation) => installation.wasInstalledBy(installedById));
	}

	/**
	 * Sort installations by installation date (newest first)
	 */
	public static sortByInstallDate(installations: PluginInstallation[]): PluginInstallation[] {
		return [...installations].sort((a, b) => {
			if (!a.installedAt && !b.installedAt) return 0;
			if (!a.installedAt) return 1;
			if (!b.installedAt) return -1;
			return new Date(b.installedAt).getTime() - new Date(a.installedAt).getTime();
		});
	}

	/**
	 * Sort installations by creation date (newest first)
	 */
	public static sortByCreationDate(installations: PluginInstallation[]): PluginInstallation[] {
		return [...installations].sort((a, b) => {
			if (!a.createdAt && !b.createdAt) return 0;
			if (!a.createdAt) return 1;
			if (!b.createdAt) return -1;
			return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
		});
	}

	/**
	 * Find latest installation for a plugin
	 */
	public static findLatestForPlugin(
		installations: PluginInstallation[],
		pluginId: string
	): PluginInstallation | undefined {
		const pluginInstallations = this.filterByPlugin(installations, pluginId);
		const sorted = this.sortByInstallDate(pluginInstallations);
		return sorted.length > 0 ? sorted[0] : undefined;
	}

	/**
	 * Check if plugin is installed by a specific user
	 */
	public static isPluginInstalledByUser(
		installations: PluginInstallation[],
		pluginId: string,
		installedById: string
	): boolean {
		return installations.some(
			(installation) =>
				installation.pluginId === pluginId &&
				installation.wasInstalledBy(installedById) &&
				installation.isInstalled()
		);
	}

	/**
	 * Group installations by status
	 */
	public static groupByStatus(
		installations: PluginInstallation[]
	): Record<PluginInstallationStatus, PluginInstallation[]> {
		const groups = Object.values(PluginInstallationStatus).reduce((acc, status) => {
			acc[status] = [];
			return acc;
		}, {} as Record<PluginInstallationStatus, PluginInstallation[]>);

		installations.forEach((installation) => {
			if (groups[installation.status]) {
				groups[installation.status].push(installation);
			}
		});

		return groups;
	}

	/**
	 * Group installations by plugin
	 */
	public static groupByPlugin(installations: PluginInstallation[]): Record<string, PluginInstallation[]> {
		const groups: Record<string, PluginInstallation[]> = {};

		installations.forEach((installation) => {
			if (installation.pluginId) {
				if (!groups[installation.pluginId]) {
					groups[installation.pluginId] = [];
				}
				groups[installation.pluginId].push(installation);
			}
		});

		return groups;
	}

	/**
	 * Calculate average installation time for successful installations
	 */
	public static calculateAverageInstallTime(installations: PluginInstallation[]): number | undefined {
		const successfulInstallations = this.filterInstalled(installations).filter(
			(installation) => installation.getInstallationDuration() !== undefined
		);

		if (successfulInstallations.length === 0) return undefined;

		const totalTime = successfulInstallations.reduce(
			(sum, installation) => sum + (installation.getInstallationDuration() || 0),
			0
		);

		return totalTime / successfulInstallations.length;
	}

	/**
	 * Get installation statistics
	 */
	public static getStatistics(installations: PluginInstallation[]): {
		total: number;
		byStatus: Record<PluginInstallationStatus, number>;
		active: number;
		successRate: number;
		averageInstallTime?: number;
	} {
		const stats = {
			total: installations.length,
			byStatus: Object.values(PluginInstallationStatus).reduce(
				(acc, status) => ({ ...acc, [status]: 0 }),
				{} as Record<PluginInstallationStatus, number>
			),
			active: 0,
			successRate: 0,
			averageInstallTime: this.calculateAverageInstallTime(installations)
		};

		installations.forEach((installation) => {
			stats.byStatus[installation.status]++;
			if (installation.isCurrentlyActive()) {
				stats.active++;
			}
		});

		if (stats.total > 0) {
			stats.successRate = (stats.byStatus[PluginInstallationStatus.INSTALLED] / stats.total) * 100;
		}

		return stats;
	}
}
