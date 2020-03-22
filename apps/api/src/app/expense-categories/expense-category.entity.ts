import { Column, Entity } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber } from 'class-validator';
import { Base } from '../core/entities/base';
import { IExpenseCategory } from '@gauzy/models';

@Entity('expense_category')
export class ExpenseCategory extends Base implements IExpenseCategory {
	@ApiProperty({ type: String })
	@IsNumber()
	@IsNotEmpty()
	@Column()
	name: string;
}
