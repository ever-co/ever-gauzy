import { Unique as TypeOrmUnique } from 'typeorm';
import { Unique as MikroOrmUnique } from '@mikro-orm/core';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { ILanguage, IOrganizationLanguage } from '@gauzy/contracts';
import { BaseEntity, OrganizationLanguage } from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity, MultiORMOneToMany } from './../core/decorators/entity';
import { MikroOrmLanguageRepository } from './repository';

@MultiORMEntity('language', { mikroOrmRepository: () => MikroOrmLanguageRepository })
@TypeOrmUnique(['code'])
@MikroOrmUnique({ properties: ['code'] })
export class Language extends BaseEntity implements ILanguage {

	@ApiProperty({ type: () => String })
	@MultiORMColumn()
	name?: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn({ nullable: true })
	@IsOptional()
	code?: string;

	@ApiProperty({ type: () => Boolean, default: true })
	@MultiORMColumn({ default: true, nullable: true })
	@IsOptional()
	is_system?: boolean;

	@ApiProperty({ type: () => String })
	@MultiORMColumn({ nullable: true })
	description?: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn()
	color?: string;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/
	@MultiORMOneToMany(() => OrganizationLanguage, (it) => it.language, {
		cascade: true
	})
	organizationLanguages?: IOrganizationLanguage[]
}
