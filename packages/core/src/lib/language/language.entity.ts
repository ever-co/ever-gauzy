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
 * Conditionally applies the appropriate Unique decorator based on the active ORM.
 * This prevents MikroORM metadata validation errors when TypeORM is the active ORM
 * (and vice versa), since MultiORMColumn only registers properties for the active ORM.
 */
function ConditionalUnique(properties: string[]): ClassDecorator {
	return (target: any) => {
		const ormType = getORMType();
		if (ormType === MultiORMEnum.TypeORM) {
			TypeOrmUnique(properties)(target);
		}
		if (ormType === MultiORMEnum.MikroORM) {
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
