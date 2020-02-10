import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Proposal } from './/proposal.entity';
import { ProposalController } from './/proposal.controller';
import { ProposalService } from './proposal.service';
import { Employee } from '../employee';

@Module({
	imports: [TypeOrmModule.forFeature([Proposal, Employee])],
	controllers: [ProposalController],
	providers: [ProposalService],
	exports: [ProposalService]
})
export class ProposalModule {}
