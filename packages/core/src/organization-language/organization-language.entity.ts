import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { IOrganizationLanguage } from '@gauzy/contracts';
import {
	Language,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { ColumnIndex } from './../core/decorators/entity/index.decorator';
import { MikroOrmOrganizationLanguageRepository } from './repository/mikro-orm-organization-language.repository';
import { MultiORMManyToOne } from '../core/decorators/entity/relations';

@MultiORMEntity('organization_language', { mikroOrmRepository: () => MikroOrmOrganizationLanguageRepository })
export class OrganizationLanguage extends TenantOrganizationBaseEntity implements IOrganizationLanguage {

	@ApiProperty({ type: () => Language })
	@MultiORMManyToOne(() => Language, {
		nullable: false,
		onDelete: 'CASCADE',
		referenceColumnName: 'code',
		joinColumn: 'languageCode'
	})
	@JoinColumn({ referencedColumnName: "code" })
	language: Language;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: OrganizationLanguage) => it.language)
	@IsString()
	@IsOptional()
	@ColumnIndex()
	@MultiORMColumn({ nullable: false, relationId: true })
	languageCode: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@MultiORMColumn()
	name: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@MultiORMColumn()
	level: string;
}
