import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestApprovalTeam } from './request-approval-team.entity';

@Module({
	imports: [TypeOrmModule.forFeature([RequestApprovalTeam])]
})
export class RequestApprovalTeamModule {}
