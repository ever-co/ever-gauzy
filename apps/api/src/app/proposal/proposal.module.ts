import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Proposal } from './proposal.entity';
import { ProposalController } from './proposal.controller';
import { ProposalService } from './proposal.service';
import { Employee } from '../employee/employee.entity';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [TypeOrmModule.forFeature([User, Proposal, Employee])],
	controllers: [ProposalController],
	providers: [ProposalService, UserService, ...CommandHandlers],
	exports: [ProposalService, UserService]
})
export class ProposalModule {}
