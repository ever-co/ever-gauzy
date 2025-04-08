import { ID, IEmployee, PluginStatus, PluginType } from '@gauzy/contracts';
import {
	ColumnIndex,
	Employee,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	MultiORMOneToMany,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Index, JoinColumn, RelationId } from 'typeorm';
import { IPluginSource } from '../../shared/models/plugin-source.model';
import { IPluginVersion } from '../../shared/models/plugin-version.model';
import { IPlugin } from '../../shared/models/plugin.model';
import { MikroOrmPluginRepository } from '../repositories/mikro-orm-plugin.repository';
import { PluginVersion } from './plugin-version.entity';

@Index('plugin_name_unique', ['name', 'tenantId', 'organizationId'], { unique: true })
@MultiORMEntity('plugin', { mikroOrmRepository: () => MikroOrmPluginRepository })
export class Plugin extends TenantOrganizationBaseEntity implements IPlugin {
	@ApiProperty({ type: String, description: 'Plugin name' })
	@IsNotEmpty({ message: 'Plugin name is required' })
	@IsString({ message: 'Plugin name must be a string' })
	@MultiORMColumn()
	name: string;

	@ApiProperty({ type: String, description: 'Plugin description', required: false })
	@IsOptional()
	@IsString({ message: 'Description must be a string' })
	@MultiORMColumn({ nullable: true })
	description?: string;

	@ApiProperty({ enum: PluginType, description: 'Type of the plugin' })
	@IsEnum(PluginType, { message: 'Invalid plugin type' })
	@MultiORMColumn({ type: 'simple-enum', enum: PluginType, default: PluginType.DESKTOP })
	type: PluginType;

	@ApiProperty({ enum: PluginStatus, description: 'Status of the plugin' })
	@IsEnum(PluginStatus, { message: 'Invalid plugin status' })
	@MultiORMColumn({ type: 'simple-enum', enum: PluginStatus, default: PluginStatus.ACTIVE })
	status: PluginStatus;

	@ApiProperty({ type: () => [PluginVersion], description: 'Versions of the plugin' })
	@MultiORMOneToMany(() => PluginVersion, (version) => version.plugin, { onDelete: 'SET NULL' })
	versions: IPluginVersion[];

	@ApiProperty({ type: String, description: 'Plugin author', required: false })
	@IsOptional()
	@IsString({ message: 'Author must be a string' })
	@MultiORMColumn({ nullable: true })
	author?: string;

	@ApiProperty({ type: String, description: 'Plugin license', required: false })
	@IsOptional()
	@IsString({ message: 'License must be a string' })
	@MultiORMColumn({ nullable: true })
	license?: string;

	@ApiProperty({ type: String, description: 'Homepage URL', required: false })
	@IsOptional()
	@IsString({ message: 'Homepage URL must be a string' })
	@MultiORMColumn({ nullable: true })
	homepage?: string;

	@ApiProperty({ type: String, description: 'Repository URL', required: false })
	@IsOptional()
	@IsString({ message: 'Repository URL must be a string' })
	@MultiORMColumn({ nullable: true })
	repository?: string;

	@ApiProperty({ type: () => Employee, description: 'Employee who uploaded the plugin', required: false })
	@MultiORMManyToOne(() => Employee, { nullable: true })
	@JoinColumn()
	uploadedBy?: IEmployee;

	@RelationId((plugin: Plugin) => plugin.uploadedBy)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	uploadedById?: ID;

	@ApiProperty({ type: Date, description: 'Upload date', required: false })
	@IsOptional()
	@IsDate({ message: 'UploadedAt must be a valid date' })
	@MultiORMColumn({ nullable: true })
	uploadedAt?: Date;

	// Computed source
	source: IPluginSource;

	// Computed field
	downloadCount: number;

	// Computed version
	version: IPluginVersion;

	// Computed state
	installed: boolean;

	@ApiProperty({ type: Date, description: 'Last downloaded date', required: false })
	@IsOptional()
	@IsDate({ message: 'LastDownloadedAt must be a valid date' })
	@MultiORMColumn({ nullable: true })
	lastDownloadedAt?: Date;
}
