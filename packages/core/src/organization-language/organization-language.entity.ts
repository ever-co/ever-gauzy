import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { IOrganizationLanguage } from '@gauzy/contracts';
import {
	Language,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../core/decorators/entity';
import { MikroOrmOrganizationLanguageRepository } from './repository/mikro-orm-organization-language.repository';

@MultiORMEntity('organization_language', { mikroOrmRepository: () => MikroOrmOrganizationLanguageRepository })
export class OrganizationLanguage extends TenantOrganizationBaseEntity implements IOrganizationLanguage {

	@ApiProperty({ type: () => Language })
	@MultiORMManyToOne(() => Language, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE',
		referenceColumnName: 'code',
		joinColumn: 'languageCode'
	})
	@JoinColumn({ referencedColumnName: "code" })
	language: Language;

	@ApiProperty({ type: () => String })
	@RelationId((it: OrganizationLanguage) => it.language)
	@IsString()
	@IsOptional()
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
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
