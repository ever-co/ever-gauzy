import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestApprovalTeam } from './request-approval-team.entity';
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Module({
	imports: [
		TypeOrmModule.forFeature([RequestApprovalTeam]),
		MikroOrmModule.forFeature([RequestApprovalTeam]),
	]
})
export class RequestApprovalTeamModule { }
