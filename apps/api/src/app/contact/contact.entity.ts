import { Column, Entity, OneToMany } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber } from 'class-validator';
import { TenantOrganizationBase } from '../core/entities/tenant-organization-base';
import {
	ICandidate,
	IContact,
	IEmployee,
	IOrganizationContact
} from '@gauzy/models';
import { OrganizationContact } from '../organization-contact/organization-contact.entity';
import { Employee } from '../employee/employee.entity';
import { Candidate } from '../candidate/candidate.entity';

@Entity('contact')
export class Contact extends TenantOrganizationBase implements IContact {
	@ApiProperty({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	name?: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	firstName?: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
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
	city?: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	address?: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	address2?: string;

	@ApiPropertyOptional({ type: Number })
	@IsNumber()
	@IsOptional()
	@Column({ nullable: true })
	postcode?: number;

	@ApiPropertyOptional({ type: Number })
	@IsNumber()
	@IsOptional()
	@Column({ nullable: true, type: 'float', scale: 6 })
	latitude?: number;

	@ApiPropertyOptional({ type: Number })
	@IsNumber()
	@IsOptional()
	@Column({ nullable: true, type: 'float', scale: 6 })
	longitude?: number;

	@ApiProperty({ type: String })
	@Column()
	@IsOptional()
	@Column({ nullable: true })
	regionCode?: string;

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	fax?: string;

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	fiscalInformation?: string;

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	website?: string;

	@ApiProperty({ type: OrganizationContact })
	@OneToMany(
		(type) => OrganizationContact,
		(organizationContact) => organizationContact.contact,
		{
			cascade: true,
			onDelete: 'CASCADE'
		}
	)
	public organization_contacts?: IOrganizationContact[];

	@ApiProperty({ type: Employee })
	@OneToMany((type) => Employee, (employee) => employee.contact)
	public employees?: IEmployee[];

	@ApiProperty({ type: Candidate })
	@OneToMany((type) => Candidate, (candidate) => candidate.contact, {
		cascade: true,
		onDelete: 'CASCADE'
	})
	public candidates?: ICandidate[];
}
