import {
	JoinColumn,
	RelationId,
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
import {
	IIncome,
	CurrenciesEnum,
	IEmployee,
	ITag,
	IOrganizationContact
} from '@gauzy/contracts';
import {
	Employee,
	OrganizationContact,
	Tag,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { ColumnNumericTransformerPipe } from './../shared/pipes';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToMany, MultiORMManyToOne } from './../core/decorators/entity';
import { MikroOrmIncomeRepository } from './repository/mikro-orm-income.repository';

@MultiORMEntity('income', { mikroOrmRepository: () => MikroOrmIncomeRepository })
export class Income extends TenantOrganizationBaseEntity implements IIncome {

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@IsNotEmpty()
	@ColumnIndex()
	@MultiORMColumn({
		type: 'numeric',
		transformer: new ColumnNumericTransformerPipe()
	})
	amount: number;

	@ApiProperty({ type: () => String, enum: CurrenciesEnum })
	@IsEnum(CurrenciesEnum)
	@IsNotEmpty()
	@ColumnIndex()
	@MultiORMColumn()
	currency: string;

	@ApiPropertyOptional({ type: () => Date })
	@IsDate()
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	valueDate?: Date;

	@ApiPropertyOptional({ type: () => String })
	@ColumnIndex()
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	notes?: string;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	isBonus: boolean;

	@ApiPropertyOptional({ type: () => String, maxLength: 256 })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	reference?: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	/**
	 * Employee
	 */
	@ApiProperty({ type: () => Employee })
	@MultiORMManyToOne(() => Employee, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	employee?: IEmployee;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: Income) => it.employee)
	@IsString()
	@IsOptional()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	employeeId?: string;

	/**
	 * Client
	 */
	@ApiPropertyOptional({ type: () => () => OrganizationContact })
	@MultiORMManyToOne(() => OrganizationContact, (organizationContact) => organizationContact.incomes, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	client?: IOrganizationContact;

	@ApiProperty({ type: () => String })
	@RelationId((it: Income) => it.client)
	@IsString()
	@IsOptional()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	clientId?: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/

	/**
	* Tag
	*/
	@ApiProperty({ type: () => () => Tag, isArray: true })
	@MultiORMManyToMany(() => Tag, (tag) => tag.incomes, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'tag_income',
		joinColumn: 'incomeId',
		inverseJoinColumn: 'tagId',
	})
	@JoinTable({
		name: 'tag_income'
	})
	tags: ITag[];
}
