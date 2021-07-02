import { Column, Entity, Index, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { IOrganizationLanguages } from '@gauzy/contracts';
import {
	Language,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('organization_language')
export class OrganizationLanguages
	extends TenantOrganizationBaseEntity
	implements IOrganizationLanguages {

	@ApiProperty({ type: () => Language })
	@ManyToOne(() => Language, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn({ referencedColumnName: "code" })
	language: Language;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: OrganizationLanguages) => it.language)
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: false })
	languageCode: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@Column()
	name: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@Column()
	level: string;
}
