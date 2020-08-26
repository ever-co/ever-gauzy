/*
  - Request Approval Employee table is the third table which will combine the employee table and the request approval table.
  - Request Approval Employee table has the many to one relationship to the RequestApproval table and the Employee table by requestApprovalId and employeeId
*/
import { Entity, Column, ManyToOne, RelationId } from 'typeorm';
import { Base } from '../core/entities/base';
import { RequestApprovalTeam as IRequestApprovalTeam } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber } from 'class-validator';
import { RequestApproval } from '../request-approval/request-approval.entity';
import { OrganizationTeam } from '../organization-team/organization-team.entity';
import { TenantBase } from '../core/entities/tenant-base';

@Entity('request_approval_team')
export class RequestApprovalTeam extends TenantBase
	implements IRequestApprovalTeam {
	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	public requestApprovalId!: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	public teamId!: string;

	@ManyToOne(
		(type) => RequestApproval,
		(requestApproval) => requestApproval.teamApprovals,
		{
			onDelete: 'CASCADE'
		}
	)
	public requestApproval!: RequestApproval;

	@ManyToOne((type) => OrganizationTeam, (team) => team.requestApprovals, {
		onDelete: 'CASCADE'
	})
	public team!: OrganizationTeam;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ nullable: true })
	status: number;

	@ApiProperty({ type: String })
	@Column()
	organization: string;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId(
		(requestApprovalTeam: RequestApprovalTeam) =>
			requestApprovalTeam.organization
	)
	@IsString()
	@Column({ nullable: true })
	organizationId: string;
}
