import { Column, Entity, OneToMany } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber } from 'class-validator';
import {
	ICandidate,
	IContact,
	IEmployee,
	IOrganizationContact
} from '@gauzy/contracts';
import {
	Candidate,
	Employee,
	OrganizationContact,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('contact')
export class Contact extends TenantOrganizationBaseEntity implements IContact {
	@ApiProperty({ type: () => String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	name?: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	firstName?: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	lastName?: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	country?: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	city?: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	address?: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	address2?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	postcode?: string;

	@ApiPropertyOptional({ type: () => Number })
	@IsNumber()
	@IsOptional()
	@Column({ nullable: true, type: 'float', scale: 6 })
	latitude?: number;

	@ApiPropertyOptional({ type: () => Number })
	@IsNumber()
	@IsOptional()
	@Column({ nullable: true, type: 'float', scale: 6 })
	longitude?: number;

	@ApiProperty({ type: () => String })
	@Column()
	@IsOptional()
	@Column({ nullable: true })
	regionCode?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	fax?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	fiscalInformation?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	website?: string;

	/*
    |--------------------------------------------------------------------------
    | @OneToMany 
    |--------------------------------------------------------------------------
    */

	/**
	 * OrganizationContact
	 */
	@ApiProperty({ type: () => OrganizationContact, isArray: true })
	@OneToMany(() => OrganizationContact, (organizationContact) => organizationContact.contact)
	public organization_contacts?: IOrganizationContact[];

	/**
	 * Employee
	 */
	@ApiProperty({ type: () => Employee, isArray: true })
	@OneToMany(() => Employee, (employee) => employee.contact)
	public employees?: IEmployee[];

	/**
	 * Candidate
	 */
	@ApiProperty({ type: () => Candidate, isArray: true })
	@OneToMany(() => Candidate, (candidate) => candidate.contact)
	public candidates?: ICandidate[];
}
