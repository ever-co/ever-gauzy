import {
	CurrenciesEnum,
	IOrganizationRecurringExpense
} from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import {
	IsDate,
	IsEnum,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	Max,
	Min,
	IsBoolean
} from 'class-validator';
import { ColumnNumericTransformerPipe } from './../shared/pipes';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmOrganizationRecurringExpenseRepository } from './repository/mikro-orm-organization-recurring-expense.repository';

@MultiORMEntity('organization_recurring_expense', { mikroOrmRepository: () => MikroOrmOrganizationRecurringExpenseRepository })
export class OrganizationRecurringExpense extends TenantOrganizationBaseEntity implements IOrganizationRecurringExpense {
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
	@IsOptional()
	@Min(1)
	@Max(31)
	@MultiORMColumn({ nullable: true })
	endDay: number;

	@ApiProperty({ type: () => Number, minimum: 1, maximum: 12 })
	@IsNumber()
	@IsOptional()
	@Min(1)
	@Max(12)
	@MultiORMColumn({ nullable: true })
	endMonth: number;

	@ApiProperty({ type: () => Number, minimum: 1 })
	@IsNumber()
	@IsOptional()
	@Min(0)
	@MultiORMColumn({ nullable: true })
	endYear: number;

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

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	splitExpense: boolean;

	@ApiProperty({ type: () => String })
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	parentRecurringExpenseId?: string;
}
