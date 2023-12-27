import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { Proposal } from './proposal.entity';
import { ProposalController } from './proposal.controller';
import { ProposalService } from './proposal.service';
import { Employee } from '../employee/employee.entity';
import { UserModule } from '../user/user.module';
import { CommandHandlers } from './commands/handlers';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.register([{ path: '/proposal', module: ProposalModule }]),
		TypeOrmModule.forFeature([Proposal, Employee]),
		TenantModule,
		UserModule
	],
	controllers: [ProposalController],
	providers: [ProposalService, ...CommandHandlers],
	exports: [ProposalService]
})
export class ProposalModule {}
