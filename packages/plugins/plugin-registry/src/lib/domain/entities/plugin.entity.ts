import { PluginStatus, PluginType } from '@gauzy/contracts';
import {
	Employee,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	MultiORMOneToMany,
	MultiORMOneToOne,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { JoinColumn } from 'typeorm';
import { MikroOrmPluginRepository } from '../repositories/mikro-orm-plugin-repository';
import { PluginVersion } from './plugin-version.entity';
import { PluginSource } from './plugin-source.entity';

@MultiORMEntity('plugin', { mikroOrmRepository: () => MikroOrmPluginRepository })
export class Plugin extends TenantOrganizationBaseEntity {
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
	@MultiORMColumn({ type: 'enum', enum: PluginType, default: PluginType.DESKTOP })
	type: PluginType;

	@ApiProperty({ enum: PluginStatus, description: 'Status of the plugin' })
	@IsEnum(PluginStatus, { message: 'Invalid plugin status' })
	@MultiORMColumn({ type: 'enum', enum: PluginStatus, default: PluginStatus.ACTIVE })
	status: PluginStatus;

	@ApiProperty({ type: () => [PluginVersion], description: 'Versions of the plugin' })
	@MultiORMOneToMany(() => PluginVersion, (version) => version.plugin, { eager: true })
	versions: PluginVersion[];

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
	uploadedBy?: Employee;

	@ApiProperty({ type: () => PluginSource, description: 'Employee who uploaded the plugin', required: false })
	@MultiORMOneToOne(() => PluginSource, { nullable: true })
	@JoinColumn()
	source?: PluginSource;

	@ApiProperty({ type: Date, description: 'Upload date', required: false })
	@IsOptional()
	@IsDate({ message: 'UploadedAt must be a valid date' })
	@MultiORMColumn({ nullable: true })
	uploadedAt?: Date;

	@ApiProperty({ type: Number, description: 'Download count' })
	@IsNumber({}, { message: 'Download count must be a number' })
	@MultiORMColumn({ default: 0 })
	downloadCount: number;

	@ApiProperty({ type: Date, description: 'Last downloaded date', required: false })
	@IsOptional()
	@IsDate({ message: 'LastDownloadedAt must be a valid date' })
	@MultiORMColumn({ nullable: true })
	lastDownloadedAt?: Date;
}
