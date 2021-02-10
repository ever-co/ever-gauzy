import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { Proposal } from './proposal.entity';
import { ProposalController } from './proposal.controller';
import { ProposalService } from './proposal.service';
import { Employee } from '../employee/employee.entity';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { CommandHandlers } from './commands/handlers';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([{ path: '/proposal', module: ProposalModule }]),
		TypeOrmModule.forFeature([User, Proposal, Employee]),
		TenantModule
	],
	controllers: [ProposalController],
	providers: [ProposalService, UserService, ...CommandHandlers],
	exports: [ProposalService, UserService]
})
export class ProposalModule {}
