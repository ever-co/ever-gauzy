import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { Proposal } from './proposal.entity';
import { ProposalController } from './proposal.controller';
import { ProposalService } from './proposal.service';
import { Employee } from '../employee/employee.entity';
import { UserModule } from '../user/user.module';
import { CommandHandlers } from './commands/handlers';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([{ path: '/proposal', module: ProposalModule }]),
		TypeOrmModule.forFeature([Proposal, Employee]),
		TenantModule,
		UserModule
	],
	controllers: [ProposalController],
	providers: [ProposalService, ...CommandHandlers],
	exports: [ProposalService]
})
export class ProposalModule {}
