/*
  - Request Approval Employee table is the third table which will combine the employee table and the request approval table.
  - Request Approval Employee table has the many to one relationship to the RequestApproval table and the Employee table by requestApprovalId and employeeId
*/
import { Entity, Column, ManyToOne } from 'typeorm';
import { Base } from '../core/entities/base';
import { RequestApprovalTeam as IRequestApprovalTeam } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber } from 'class-validator';
import { RequestApproval } from '../request-approval/request-approval.entity';
import { OrganizationTeam } from '../organization-team/organization-team.entity';

@Entity('request_approval_team')
export class RequestApprovalTeam extends Base implements IRequestApprovalTeam {
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
}
