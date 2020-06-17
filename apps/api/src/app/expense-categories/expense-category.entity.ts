import { Column, Entity, ManyToMany, JoinTable } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber } from 'class-validator';
import { Base } from '../core/entities/base';
import { IExpenseCategory } from '@gauzy/models';
import { Tag } from '../tags/tag.entity';

@Entity('expense_category')
export class ExpenseCategory extends Base implements IExpenseCategory {
	@ApiProperty()
	@ManyToMany((type) => Tag, (tag) => tag.expenseCategory)
	@JoinTable({
		name: 'tag_organization_expense_categories'
	})
	tags?: Tag[];

	@ApiProperty({ type: String })
	@IsNumber()
	@IsNotEmpty()
	@Column()
	name: string;
}
