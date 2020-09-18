import { Column, Entity, ManyToMany, JoinTable } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { IExpenseCategory } from '@gauzy/models';
import { Tag } from '../tags/tag.entity';
import { TenantOrganizationBase } from '../core/entities/tenant-organization-base';

@Entity('expense_category')
export class ExpenseCategory extends TenantOrganizationBase
	implements IExpenseCategory {
	@ApiProperty()
	@ManyToMany((type) => Tag, (tag) => tag.expenseCategory)
	@JoinTable({
		name: 'tag_organization_expense_categories'
	})
	tags?: Tag[];

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	name: string;
}
