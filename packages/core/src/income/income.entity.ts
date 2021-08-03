import {
	Column,
	Entity,
	Index,
	JoinColumn,
	RelationId,
	ManyToOne,
	ManyToMany,
	JoinTable
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsNotEmpty,
	IsString,
	IsNumber,
	IsOptional,
	IsDate,
	IsEnum,
	IsBoolean
} from 'class-validator';
import { IIncome, CurrenciesEnum, IEmployee, ITag, IOrganizationContact } from '@gauzy/contracts';
import {
	Employee,
	OrganizationContact,
	Tag,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('income')
export class Income extends TenantOrganizationBaseEntity implements IIncome {
	
	@ApiProperty({ type: () => Number })
	@IsNumber()
	@IsNotEmpty()
	@Index()
	@Column({ type: 'numeric' })
	amount: number;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	clientName: string;

	@ApiProperty({ type: () => String, enum: CurrenciesEnum })
	@IsEnum(CurrenciesEnum)
	@IsNotEmpty()
	@Index()
	@Column()
	currency: string;

	@ApiPropertyOptional({ type: () => Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	valueDate?: Date;

	@ApiPropertyOptional({ type: () => String })
	@Index()
	@IsOptional()
	@Column({ nullable: true })
	notes?: string;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@IsOptional()
	@Column({ nullable: true })
	isBonus: boolean;

	@ApiPropertyOptional({ type: () => String, maxLength: 256 })
	@IsOptional()
	@Column({ nullable: true })
	reference?: string;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne 
    |--------------------------------------------------------------------------
    */
	// Income Employee
	@ApiProperty({ type: () => Employee })
	@ManyToOne(() => Employee, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	employee?: IEmployee;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: Income) => it.employee)
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	readonly employeeId?: string;

	// Client
	@ApiPropertyOptional({ type: () => () => OrganizationContact })
	@ManyToOne(() => OrganizationContact, { nullable: true })
	@JoinColumn()
	client?: IOrganizationContact;

	@ApiProperty({ type: () => String })
	@RelationId((it: Income) => it.client)
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	clientId?: string;

	/*
    |--------------------------------------------------------------------------
    | @ManyToMany 
    |--------------------------------------------------------------------------
    */
	// Tags
	@ManyToMany(() => Tag, (tag) => tag.income)
	@JoinTable({ name: 'tag_income' })
	tags: ITag[];
}
