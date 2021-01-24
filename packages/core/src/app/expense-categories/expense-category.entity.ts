import { Column, Entity, ManyToMany, JoinTable } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { IExpenseCategory } from '@gauzy/contracts';
import { DeepPartial } from '@gauzy/common';
import { Tag, TenantOrganizationBaseEntity } from '../core/entities/internal';

@Entity('expense_category')
export class ExpenseCategory
	extends TenantOrganizationBaseEntity
	implements IExpenseCategory {
	constructor(input?: DeepPartial<ExpenseCategory>) {
		super(input);
	}

	@ApiProperty()
	@ManyToMany(() => Tag, (tag) => tag.expenseCategory)
	@JoinTable({
		name: 'tag_organization_expense_category'
	})
	tags?: Tag[];

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	name: string;
}
