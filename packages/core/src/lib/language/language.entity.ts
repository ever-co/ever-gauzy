import { Unique as TypeOrmUnique } from 'typeorm';
import { Unique as MikroOrmUnique } from '@mikro-orm/core';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { ILanguage, IOrganizationLanguage } from '@gauzy/contracts';
import { BaseEntity, OrganizationLanguage } from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity, MultiORMOneToMany } from './../core/decorators/entity';
import { MikroOrmLanguageRepository } from './repository/mikro-orm-language.repository';
import { MultiORMEnum, getORMType } from '../core/utils';

/**
 * Applies TypeORM's Unique decorator under every ORM, like `MultiORMColumn` registers TypeORM's columns,
 * and MikroORM's only under `DB_ORM=mikro-orm`: MikroORM validates the properties registered for it, and
 * MultiORMColumn registers MikroORM properties only when MikroORM is active.
 */
function ConditionalUnique(properties: string[]): ClassDecorator {
	return (target: any) => {
		TypeOrmUnique(properties)(target);

		if (getORMType() === MultiORMEnum.MikroORM) {
			MikroOrmUnique({ properties } as any)(target);
		}
	};
}

@MultiORMEntity('language', { mikroOrmRepository: () => MikroOrmLanguageRepository })
@ConditionalUnique(['code'])
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
	organizationLanguages?: IOrganizationLanguage[];
}
