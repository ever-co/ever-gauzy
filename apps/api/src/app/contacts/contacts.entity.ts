import {
	Column,
	Entity,
	Index,
	JoinColumn,
	ManyToMany,
	OneToMany,
	ManyToOne,
	JoinTable,
	OneToOne,
	RelationId
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsNumber } from 'class-validator';
import { Base } from '../core/entities/base';
import { Contacts as IContacts } from '../../../../../libs/models/src/lib/contacts.model';
import { OrganizationClients } from '../organization-clients/organization-clients.entity';

@Entity('contact')
export class Contacts extends Base implements IContacts {
	@ApiProperty({ type: String })
	@IsString()
	// @IsNotEmpty()
	// @Index()
	@IsOptional()
	@Column()
	name?: string;

	@ApiProperty({ type: String })
	@IsString()
	// @IsNotEmpty()
	// @Index()
	@IsOptional()
	@Column()
	firstName?: string;

	@ApiProperty({ type: String })
	@IsString()
	// @IsNotEmpty()
	// @Index()
	@IsOptional()
	@Column()
	lastName?: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	country?: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	street?: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	city?: string;

	@ApiPropertyOptional({ type: Number })
	@IsNumber()
	@IsOptional()
	@Column({ nullable: true })
	zipCode?: number;

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	state?: string;

	// @ApiProperty({ type: OrganizationClients })
	// @ManyToOne(() => OrganizationClients, { nullable: true, onDelete: 'CASCADE' })
	// @JoinColumn()
	// organizationClient: OrganizationClients;

	// @ApiProperty({ type: String, readOnly: true })
	// @RelationId((contact: Contacts) => contact.organizationClient)
	// readonly organzationClientId?: string;
}
