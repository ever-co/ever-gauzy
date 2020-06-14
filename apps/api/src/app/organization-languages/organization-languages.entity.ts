import { Column, Entity, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { Base } from '../core/entities/base';
import { OrganizationLanguages as IOrganizationLanguages } from '@gauzy/models';
import { Language } from '../language/language.entity';
import { Organization } from '../organization/organization.entity';

@Entity('organization_languages')
export class OrganizationLanguages extends Base
	implements IOrganizationLanguages {
	@ApiProperty({ type: Organization })
	@ManyToOne((type) => Organization, { nullable: false, onDelete: 'CASCADE' })
	@JoinColumn()
	organization: Organization;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId(
		(organization_languages: OrganizationLanguages) =>
			organization_languages.organization
	)
	readonly organizationId: string;

	@ApiProperty({ type: Language })
	@ManyToOne((type) => Language, { nullable: false, onDelete: 'CASCADE' })
	@JoinColumn()
	language: Language;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId(
		(organization_language: OrganizationLanguages) =>
			organization_language.language
	)
	readonly languageId: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	level: string;
}
