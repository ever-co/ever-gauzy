import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	MultiORMOneToMany,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Min, ValidateIf } from 'class-validator';
import { MikroOrmPluginVersionRepository } from '../repositories/mikro-orm-plugin-version.repository';
import { Plugin } from './plugin.entity';
import { Index, JoinColumn, RelationId } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { IPluginVersion } from '../../shared/models/plugin-version.model';
import { IPlugin } from '../../shared/models/plugin.model';
import { PluginSource } from './plugin-source.entity';
import { IPluginSource } from '../../shared/models/plugin-source.model';
import { isMySQL } from '@gauzy/config';
import { PluginInstallation } from './plugin-installation.entity';
import { IPluginInstallation } from '../../shared/models/plugin-installation.model';

@Index(
	'version_number_unique',
	isMySQL ? ['number', 'pluginId', 'organizationId'] : ['number', 'pluginId', 'tenantId', 'organizationId'],
	{ unique: true }
)
@MultiORMEntity('plugin_version', { mikroOrmRepository: () => MikroOrmPluginVersionRepository })
export class PluginVersion extends TenantOrganizationBaseEntity implements IPluginVersion {
	@ApiProperty({
		type: () => String,
		description: 'Version following SemVer (MAJOR.MINOR.PATCH[-prerelease][+build])'
	})
	@IsNotEmpty({ message: 'Version is required' })
	@IsString({ message: 'Version must be a string' })
	@Matches(/^(\d+\.\d+\.\d+)(-[0-9A-Za-z-.]+)?(\+[0-9A-Za-z-.]+)?$/, {
		message: 'Version must follow SemVer format: MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]'
	})
	@MultiORMColumn()
	number: string;

	@ApiProperty({ type: () => String, description: 'Change Log of the plugin version' })
	@IsNotEmpty({ message: 'Change Log is required' })
	@IsString({ message: 'Change Log must be a string' })
	@MultiORMColumn()
	changelog: string;

	@ApiProperty({ type: () => String, description: 'Verification hash of the plugin version' })
	@IsOptional()
	@IsString({ message: 'Checksum must be a string' })
	@MultiORMColumn({ nullable: true })
	checksum?: string;

	@ApiProperty({ type: () => String, description: 'Digital signature for authenticity verification' })
	@IsOptional()
	@IsString({ message: 'Signature must be a string' })
	@MultiORMColumn({ nullable: true })
	signature?: string;

	@ApiPropertyOptional({ type: () => String, description: 'Date when the release was recorded' })
	@IsOptional()
	@IsDateString({}, { message: 'Release date must be a valid ISO 8601 date string' })
	@ValidateIf((o) => o.releaseDate !== null && o.releaseDate !== undefined)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	releaseDate: Date;

	@ApiProperty({ type: () => Number, description: 'Download count' })
	@IsOptional()
	@IsNumber({}, { message: 'Download count must be a number' })
	@Min(0, { message: 'Download count must be greater than or equal to 0' })
	@Transform(({ value }) => (value ? parseFloat(value) : 0), { toClassOnly: true })
	@MultiORMColumn({ nullable: true, default: 0 })
	downloadCount: number;

	@ApiProperty({ type: () => Plugin, description: 'Plugin associated with the version', required: true })
	@MultiORMManyToOne(() => Plugin, (plugin) => plugin.versions, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	plugin?: IPlugin;

	@RelationId((version: PluginVersion) => version.plugin)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	pluginId?: ID;

	@ApiProperty({ type: () => [PluginSource], description: 'Sources of the plugin version', required: false })
	@MultiORMOneToMany(() => PluginSource, (source) => source.version, { nullable: true, onDelete: 'CASCADE' })
	sources?: IPluginSource[];

	@ApiProperty({
		type: () => [PluginInstallation],
		description: 'Related installations to plugin version',
		required: false
	})
	@MultiORMOneToMany(() => PluginInstallation, (source) => source.version, { nullable: true, onDelete: 'CASCADE' })
	installations?: IPluginInstallation[];
}
