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
import { ColumnNumericTransformerPipe } from './../shared/pipes';
import { MultiORMColumn, MultiORMEntity, MultiORMOneToOne } from './../core/decorators/entity';
import { MikroOrmContactRepository } from './repository/mikro-orm-contact.repository';

@MultiORMEntity('contact', { mikroOrmRepository: () => MikroOrmContactRepository })
export class Contact extends TenantOrganizationBaseEntity implements IContact {

	@ApiProperty({ type: () => String })
	@IsString()
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	name?: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	firstName?: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	lastName?: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	country?: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	city?: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	address?: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	address2?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsString()
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	postcode?: string;

	@ApiPropertyOptional({ type: () => Number })
	@IsNumber()
	@IsOptional()
	@MultiORMColumn({
		nullable: true,
		type: 'numeric',
		transformer: new ColumnNumericTransformerPipe()
	})
	latitude?: number;

	@ApiPropertyOptional({ type: () => Number })
	@IsNumber()
	@IsOptional()
	@MultiORMColumn({
		nullable: true,
		type: 'numeric',
		transformer: new ColumnNumericTransformerPipe()
	})
	longitude?: number;

	@ApiProperty({ type: () => String })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	regionCode?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsString()
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	fax?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsString()
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	fiscalInformation?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsString()
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	website?: string;

	/*
	|--------------------------------------------------------------------------
	| @OneToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Employee
	 */
	@MultiORMOneToOne(() => Employee, (employee) => employee.contact, {
		/** Database cascade action on delete. */
		onDelete: 'SET NULL',

		/** This column is a boolean flag indicating that this is the inverse side of the relationship, and it doesn't control the foreign key directly  */
		owner: false
	})
	employee?: IEmployee;

	/**
	 * Employee
	 */
	@MultiORMOneToOne(() => Candidate, (candidate) => candidate.contact, {
		/** Database cascade action on delete. */
		onDelete: 'SET NULL',

		/** This column is a boolean flag indicating that this is the inverse side of the relationship, and it doesn't control the foreign key directly  */
		owner: false
	})
	candidate?: ICandidate;

	/**
	 * Organization Contact
	 */
	@MultiORMOneToOne(() => OrganizationContact, (organizationContact) => organizationContact.contact, {
		/** Database cascade action on delete. */
		onDelete: 'SET NULL',

		/** This column is a boolean flag indicating that this is the inverse side of the relationship, and it doesn't control the foreign key directly  */
		owner: false
	})
	organizationContact?: IOrganizationContact;
}
