import { Column, Entity, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { IOrganizationLanguages } from '@gauzy/models';
import { Language } from '../language/language.entity';
import { TenantOrganizationBase } from '../core/entities/tenant-organization-base';

@Entity('organization_language')
export class OrganizationLanguages extends TenantOrganizationBase
	implements IOrganizationLanguages {
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
