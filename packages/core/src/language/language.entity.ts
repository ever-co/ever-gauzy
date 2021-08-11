import { Entity, Column, Unique, OneToMany, JoinColumn } from 'typeorm';
import { ILanguage, IOrganizationLanguage } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { BaseEntity, OrganizationLanguage } from '../core/entities/internal';

@Entity('language')
@Unique(['code'])
export class Language extends BaseEntity implements ILanguage {
	@ApiProperty({ type: () => String })
	@Column()
	name?: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	@IsOptional()
	code?: string;

	@ApiProperty({ type: () => Boolean, default: true })
	@Column({ default: true, nullable: true })
	@IsOptional()
	is_system?: boolean;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	description?: string;

	@ApiProperty({ type: () => String })
	@Column()
	color?: string;

	@OneToMany(() => OrganizationLanguage, (organizationLanguage) => organizationLanguage.language, { 
		cascade: true 
	})
	@JoinColumn()
	organizationLanguages?: IOrganizationLanguage[]
}
