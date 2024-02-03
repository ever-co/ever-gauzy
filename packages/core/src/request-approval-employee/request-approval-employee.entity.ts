/*
  - Request Approval Employee table is the third table which will combine the employee table and the request approval table.
  - Request Approval Employee table has the many to one relationship to the RequestApproval table and the Employee table by requestApprovalId and employeeId
*/
import { Column, Index, RelationId } from 'typeorm';
import { IEmployee, IRequestApproval, IRequestApprovalEmployee } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber } from 'class-validator';
import {
	Employee,
	RequestApproval,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmRequestApprovalEmployeeRepository } from './repository/mikro-orm-request-approval-employee.repository';
import { MultiORMManyToOne } from '../core/decorators/entity/relations';

@MultiORMEntity('request_approval_employee', { mikroOrmRepository: () => MikroOrmRequestApprovalEmployeeRepository })
export class RequestApprovalEmployee extends TenantOrganizationBaseEntity implements IRequestApprovalEmployee {

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@Column({ nullable: true })
	status: number;

	@MultiORMManyToOne(() => RequestApproval, (requestApproval) => requestApproval.employeeApprovals, {
		onDelete: 'CASCADE'
	})
	public requestApproval!: IRequestApproval;

	@ApiProperty({ type: () => String })
	@RelationId((it: RequestApprovalEmployee) => it.requestApproval)
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	public requestApprovalId!: string;

	@MultiORMManyToOne(() => Employee, (employee) => employee.requestApprovals, {
		onDelete: 'CASCADE'
	})
	public employee!: IEmployee;

	@ApiProperty({ type: () => String })
	@RelationId((it: RequestApprovalEmployee) => it.employee)
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	public employeeId!: string;
}
