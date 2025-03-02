import { CurrenciesEnum, ID, IEmployee, IEmployeeRecurringExpense } from '@gauzy/contracts';
import { Optional } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsString, Max, Min, IsDate, IsOptional } from 'class-validator';
import { RelationId } from 'typeorm';
import { Employee, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnNumericTransformerPipe } from './../shared/pipes';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../core/decorators/entity';
import { MikroOrmEmployeeRecurringExpenseRepository } from './repository/mikro-orm-employee-recurring-expense.repository';

@MultiORMEntity('employee_recurring_expense', { mikroOrmRepository: () => MikroOrmEmployeeRecurringExpenseRepository })
export class EmployeeRecurringExpense extends TenantOrganizationBaseEntity implements IEmployeeRecurringExpense {
	@ApiProperty({ type: () => Number, minimum: 1, maximum: 31 })
	@IsNumber()
	@IsNotEmpty()
	@Min(1)
	@Max(31)
	@MultiORMColumn()
	startDay: number;

	@ApiProperty({ type: () => Number, minimum: 1, maximum: 12 })
	@IsNumber()
	@IsNotEmpty()
	@Min(1)
	@Max(12)
	@MultiORMColumn()
	startMonth: number;

	@ApiProperty({ type: () => Number, minimum: 1 })
	@IsNumber()
	@IsNotEmpty()
	@Min(0)
	@MultiORMColumn()
	startYear: number;

	@ApiProperty({ type: () => Date })
	@IsDate()
	@MultiORMColumn()
	startDate: Date;

	@ApiProperty({ type: () => Number, minimum: 1, maximum: 31 })
	@IsNumber()
	@Optional()
	@Min(1)
	@Max(31)
	@MultiORMColumn({ nullable: true })
	endDay?: number;

	@ApiProperty({ type: () => Number, minimum: 1, maximum: 12 })
	@IsNumber()
	@Optional()
	@Min(1)
	@Max(12)
	@MultiORMColumn({ nullable: true })
	endMonth?: number;

	@ApiProperty({ type: () => Number, minimum: 1 })
	@IsNumber()
	@Optional()
	@Min(0)
	@MultiORMColumn({ nullable: true })
	endYear?: number;

	@ApiProperty({ type: () => Date })
	@IsDate()
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	endDate?: Date;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@ColumnIndex()
	@MultiORMColumn()
	categoryName: string;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@IsNotEmpty()
	@MultiORMColumn({
		type: 'numeric',
		transformer: new ColumnNumericTransformerPipe()
	})
	value: number;

	@ApiProperty({ type: () => String, enum: CurrenciesEnum })
	@IsEnum(CurrenciesEnum)
	@IsNotEmpty()
	@ColumnIndex()
	@MultiORMColumn()
	currency: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	parentRecurringExpenseId?: ID;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	@ApiProperty({ type: () => Employee })
	@MultiORMManyToOne(() => Employee, {
		onDelete: 'CASCADE',
		nullable: true
	})
	employee?: IEmployee;

	@ApiProperty({ type: () => String })
	@RelationId((it: EmployeeRecurringExpense) => it.employee)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	employeeId: ID;
}
