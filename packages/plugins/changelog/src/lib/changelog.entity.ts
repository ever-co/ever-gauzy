import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDate, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import {
	CHANGELOG_PLATFORM_MAX_LENGTH,
	CHANGELOG_PLATFORM_PATTERN,
	DEFAULT_CHANGELOG_PLATFORM,
	IChangelog
} from '@gauzy/contracts';
import { MultiORMEntity, TenantOrganizationBaseEntity, MultiORMColumn } from '@gauzy/core';
import { MikroOrmChangelogRepository } from './repository/mikro-orm-changelog.repository';

@MultiORMEntity('changelog', { mikroOrmRepository: () => MikroOrmChangelogRepository })
export class Changelog extends TenantOrganizationBaseEntity implements IChangelog {
	@ApiProperty({ type: () => String })
	@IsString()
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	icon?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsString()
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	title?: string;

	@ApiProperty({ type: () => Date })
	@IsDate()
	@IsOptional()
	@MultiORMColumn()
	date?: Date;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsOptional()
	@MultiORMColumn()
	content?: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsBoolean()
	@MultiORMColumn({ type: Boolean, nullable: true })
	isFeature?: boolean;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	learnMoreUrl?: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	imageUrl?: string;

	/**
	 * The product the entry belongs to (`gauzy`, `ever-teams`, `ever-works`, ...). One table feeds the
	 * "What's new" of several products, and each asks for its own entries. No property initializer on
	 * purpose: an update that leaves the product out must not move the entry back to Gauzy.
	 */
	@ApiPropertyOptional({ type: () => String, default: DEFAULT_CHANGELOG_PLATFORM })
	@IsOptional()
	@IsString()
	@MaxLength(CHANGELOG_PLATFORM_MAX_LENGTH)
	@Matches(CHANGELOG_PLATFORM_PATTERN)
	@MultiORMColumn({ type: 'varchar', length: CHANGELOG_PLATFORM_MAX_LENGTH, default: DEFAULT_CHANGELOG_PLATFORM })
	platform?: string;
}
