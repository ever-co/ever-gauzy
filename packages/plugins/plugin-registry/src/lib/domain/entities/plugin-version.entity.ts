import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Min, ValidateIf } from 'class-validator';
import { MikroOrmPluginVersionRepository } from '../repositories/mikro-orm-plugin-version-repository';
import { Plugin } from './plugin.entity';
import { JoinColumn } from 'typeorm';

@MultiORMEntity('plugin_version', { mikroOrmRepository: () => MikroOrmPluginVersionRepository })
export class PluginVersion extends TenantOrganizationBaseEntity {
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
	version: string;

	@ApiProperty({ type: () => String, description: 'Change Log of the plugin version' })
	@IsNotEmpty({ message: 'Change Log is required' })
	@IsString({ message: 'Change Log must be a string' })
	@MultiORMColumn()
	changelog: string;

	@ApiPropertyOptional({ type: () => String, description: 'Date when the release was recorded' })
	@IsOptional()
	@IsDateString({}, { message: 'Release date must be a valid ISO 8601 date string' })
	@ValidateIf((o) => o.releaseDate && o.releaseDate <= new Date())
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
	@MultiORMManyToOne(() => Plugin, (plugin) => plugin.versions, { nullable: true })
	@JoinColumn()
	plugin?: Plugin;
}
