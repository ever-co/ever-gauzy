import { JoinTable } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { IExpense, IExpenseCategory, ITag } from '@gauzy/contracts';
import { Expense, Tag, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity, MultiORMManyToMany, MultiORMOneToMany } from './../core/decorators/entity';
import { MikroOrmExpenseCategoryRepository } from './repository/mikro-orm-expense-category.repository';

@MultiORMEntity('expense_category', { mikroOrmRepository: () => MikroOrmExpenseCategoryRepository })
export class ExpenseCategory extends TenantOrganizationBaseEntity implements IExpenseCategory {

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@MultiORMColumn()
	name: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * Expense
	 */
	@ApiPropertyOptional({ type: () => Expense, isArray: true })
	@MultiORMOneToMany(() => Expense, (expense) => expense.category, {
		onDelete: 'SET NULL'
	})
	expenses?: IExpense[];

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * Tag
	 */
	@ApiPropertyOptional({ type: () => Tag, isArray: true })
	@MultiORMManyToMany(() => Tag, (tag) => tag.expenseCategories, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'tag_organization_expense_category',
		joinColumn: 'expenseCategoryId',
		inverseJoinColumn: 'tagId',
	})
	@JoinTable({
		name: 'tag_organization_expense_category'
	})
	tags?: ITag[];
}
