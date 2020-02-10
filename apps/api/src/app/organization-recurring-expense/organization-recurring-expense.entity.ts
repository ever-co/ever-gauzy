import { Column, Entity, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import {
	IsNotEmpty,
	IsString,
	IsNumber,
	Min,
	Max,
	IsEnum
} from 'class-validator';
import { Base } from '../core/entities/base';
import {
	OrganizationRecurringExpense as IOrganizationRecurringExpense,
	CurrenciesEnum
} from '@gauzy/models';

@Entity('organization_recurring_expense')
export class OrganizationRecurringExpense extends Base
	implements IOrganizationRecurringExpense {
	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	orgId: string;

	@ApiProperty({ type: Number, minimum: 1, maximum: 12 })
	@IsNumber()
	@IsNotEmpty()
	@Min(1)
	@Max(12)
	@Column()
	month: number;

	@ApiProperty({ type: Number, minimum: 1 })
	@IsNumber()
	@IsNotEmpty()
	@Min(0)
	@Column()
	year: number;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	categoryName: string;

	@ApiProperty({ type: Number })
	@IsNumber()
	@IsNotEmpty()
	@Column({ type: 'numeric' })
	value: number;

	@ApiProperty({ type: String, enum: CurrenciesEnum })
	@IsEnum(CurrenciesEnum)
	@IsNotEmpty()
	@Index()
	@Column()
	currency: string;
}
