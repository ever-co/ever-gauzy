import { Column, Entity, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { IOrganizationLanguages } from '@gauzy/contracts';
import { DeepPartial } from '@gauzy/common';
import { Language, TenantOrganizationBaseEntity } from '../internal';

@Entity('organization_language')
export class OrganizationLanguages
	extends TenantOrganizationBaseEntity
	implements IOrganizationLanguages {
	constructor(input?: DeepPartial<OrganizationLanguages>) {
		super(input);
	}

	@ApiProperty({ type: Language })
	@ManyToOne(() => Language, { nullable: false, onDelete: 'CASCADE' })
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
