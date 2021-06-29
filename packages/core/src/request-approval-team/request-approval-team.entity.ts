/*
  - Request Approval Employee table is the third table which will combine the employee table and the request approval table.
  - Request Approval Employee table has the many to one relationship to the RequestApproval table and the Employee table by requestApprovalId and employeeId
*/
import { Entity, Column, ManyToOne, RelationId, Index } from 'typeorm';
import { IOrganizationTeam, IRequestApproval, IRequestApprovalTeam } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber } from 'class-validator';
import {
	OrganizationTeam,
	RequestApproval,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('request_approval_team')
export class RequestApprovalTeam
	extends TenantOrganizationBaseEntity
	implements IRequestApprovalTeam {

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@Column({ nullable: true })
	status: number;

	@ManyToOne(() => RequestApproval, (requestApproval) => requestApproval.teamApprovals, { 
		onDelete: 'CASCADE'
	})
	public requestApproval!: IRequestApproval;

	@ApiProperty({ type: () => String })
	@RelationId((it: RequestApprovalTeam) => it.requestApproval)
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	public requestApprovalId!: string;

	@ManyToOne(() => OrganizationTeam, (team) => team.requestApprovals, {
		onDelete: 'CASCADE'
	})
	public team!: IOrganizationTeam;

	@ApiProperty({ type: () => String })
	@RelationId((it: RequestApprovalTeam) => it.team)
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	public teamId!: string;
}
