/*
  - Request Approval Employee table is the third table which will combine the employee table and the request approval table.
  - Request Approval Employee table has the many to one relationship to the RequestApproval table and the Employee table by requestApprovalId and employeeId
*/
import { Entity, Column, ManyToOne } from 'typeorm';
import { DeepPartial, IRequestApprovalTeam } from '@gauzy/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber } from 'class-validator';
import {
	OrganizationTeam,
	RequestApproval,
	TenantOrganizationBaseEntity
} from '../internal';

@Entity('request_approval_team')
export class RequestApprovalTeam
	extends TenantOrganizationBaseEntity
	implements IRequestApprovalTeam {
	constructor(input?: DeepPartial<RequestApprovalTeam>) {
		super(input);
	}

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
		() => RequestApproval,
		(requestApproval) => requestApproval.teamApprovals,
		{
			onDelete: 'CASCADE'
		}
	)
	public requestApproval!: RequestApproval;

	@ManyToOne(() => OrganizationTeam, (team) => team.requestApprovals, {
		onDelete: 'CASCADE'
	})
	public team!: OrganizationTeam;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ nullable: true })
	status: number;
}
