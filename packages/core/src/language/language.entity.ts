import { Unique, JoinColumn } from 'typeorm';
import { ILanguage, IOrganizationLanguage } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { BaseEntity, OrganizationLanguage } from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmLanguageRepository } from './repository/mikro-orm-language.repository';
import { MultiORMOneToMany } from '../core/decorators/entity/relations';

@MultiORMEntity('language', { mikroOrmRepository: () => MikroOrmLanguageRepository })
@Unique(['code'])
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

	@MultiORMOneToMany(() => OrganizationLanguage, (organizationLanguage) => organizationLanguage.language, {
		cascade: true
	})
	@JoinColumn()
	organizationLanguages?: IOrganizationLanguage[]
}
