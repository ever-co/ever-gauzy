import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Proposal } from './/proposal.entity';
import { ProposalController } from './/proposal.controller';
import { ProposalService } from './proposal.service';
import { Employee } from '../employee';
import { User, UserService } from '../user';

@Module({
	imports: [TypeOrmModule.forFeature([User, Proposal, Employee])],
	controllers: [ProposalController],
	providers: [ProposalService, UserService],
	exports: [ProposalService, UserService]
})
export class ProposalModule {}
