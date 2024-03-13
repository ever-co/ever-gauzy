import { RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IEmployee, IEmployeeProposalTemplate } from '@gauzy/contracts';
import {
	Employee,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../core/decorators/entity';
import { MikroOrmEmployeeProposalTemplateRepository } from './repository/mikro-orm-employee-proposal-template.repository';

@MultiORMEntity('employee_proposal_template', { mikroOrmRepository: () => MikroOrmEmployeeProposalTemplateRepository })
export class EmployeeProposalTemplate extends TenantOrganizationBaseEntity
	implements IEmployeeProposalTemplate {

	@ApiProperty({ type: () => String })
	@ColumnIndex()
	@MultiORMColumn()
	name?: string;

	@ApiProperty({ type: () => String })
	@ColumnIndex({ fulltext: true })
	@MultiORMColumn({ type: 'text', nullable: true })
	content?: string;

	@ApiProperty({ type: () => Boolean })
	@ColumnIndex()
	@MultiORMColumn({ default: false })
	isDefault?: boolean;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	@ApiProperty({ type: () => Employee })
	@MultiORMManyToOne(() => Employee, {
		onDelete: 'CASCADE'
	})
	employee?: IEmployee;

	@ApiProperty({ type: () => String })
	@RelationId((it: EmployeeProposalTemplate) => it.employee)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	employeeId?: string;
}
