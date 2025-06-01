import { ID, IEmployee } from '@gauzy/contracts';
import {
	ColumnIndex,
	Employee,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, ValidateIf } from 'class-validator';
import { JoinColumn, RelationId } from 'typeorm';
import { IPluginInstallation, PluginInstallationStatus } from '../../shared/models/plugin-installation.model';
import { IPluginVersion } from '../../shared/models/plugin-version.model';
import { IPlugin } from '../../shared/models/plugin.model';
import { MikroOrmPluginInstallationRepository } from '../repositories/mikro-orm-plugin-installation.repository';
import { PluginVersion } from './plugin-version.entity';
import { Plugin } from './plugin.entity';

@MultiORMEntity('plugin_installation', { mikroOrmRepository: () => MikroOrmPluginInstallationRepository })
export class PluginInstallation extends TenantOrganizationBaseEntity implements IPluginInstallation {
	@ApiProperty({ type: () => Plugin, description: 'Installed the plugin' })
	@MultiORMManyToOne(() => Plugin, { onDelete: 'CASCADE' })
	plugin: IPlugin;

	@RelationId((installation: PluginInstallation) => installation.plugin)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	pluginId?: ID;

	@ApiProperty({ type: () => PluginVersion, description: 'Installed version of the plugin' })
	@MultiORMManyToOne(() => PluginVersion, (version: PluginVersion) => version.installations, { onDelete: 'SET NULL' })
	@JoinColumn()
	version: IPluginVersion;

	@RelationId((installation: PluginInstallation) => installation.version)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	versionId?: ID;

	@ApiProperty({ type: () => Employee, description: 'Employee who installed the plugin', required: false })
	@MultiORMManyToOne(() => Employee, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn()
	installedBy: IEmployee;

	@RelationId((installation: PluginInstallation) => installation.installedBy)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
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
}
