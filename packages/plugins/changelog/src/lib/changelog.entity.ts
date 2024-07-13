import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDate, IsOptional, IsString } from 'class-validator';
import { IChangelog } from '@gauzy/contracts';
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
}
