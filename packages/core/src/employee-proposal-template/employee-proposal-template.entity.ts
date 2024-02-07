import { Index, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IEmployee, IEmployeeProposalTemplate } from '@gauzy/contracts';
import {
	Employee,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmEmployeeProposalTemplateRepository } from './repository/mikro-orm-employee-proposal-template.repository';
import { MultiORMManyToOne } from '../core/decorators/entity/relations';

@MultiORMEntity('employee_proposal_template', { mikroOrmRepository: () => MikroOrmEmployeeProposalTemplateRepository })
export class EmployeeProposalTemplate extends TenantOrganizationBaseEntity
	implements IEmployeeProposalTemplate {

	@ApiProperty({ type: () => String })
	@Index()
	@MultiORMColumn()
	name?: string;

	@ApiProperty({ type: () => String })
	@Index({ fulltext: true })
	@MultiORMColumn({ type: 'text', nullable: true })
	content?: string;

	@ApiProperty({ type: () => Boolean })
	@Index()
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
	@Index()
	@MultiORMColumn()
	employeeId?: string;
}
