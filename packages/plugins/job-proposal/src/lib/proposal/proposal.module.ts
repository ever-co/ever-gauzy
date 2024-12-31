import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule, SeederModule } from '@gauzy/core';
import { Proposal } from './proposal.entity';
import { ProposalController } from './proposal.controller';
import { ProposalService } from './proposal.service';
import { CommandHandlers } from './commands/handlers';
import { ProposalSeederService } from './proposal-seeder.service';
import { TypeOrmProposalRepository } from './repository/type-orm-proposal.repository';
import { MikroOrmProposalRepository } from './repository/mikro-orm-proposal.repository';

@Module({
	controllers: [
		ProposalController
	],
	imports: [
		TypeOrmModule.forFeature([Proposal]),
		MikroOrmModule.forFeature([Proposal]),
		RolePermissionModule,
		SeederModule,
		CqrsModule
	],
	providers: [
		ProposalService,
		ProposalSeederService,
		TypeOrmProposalRepository,
		MikroOrmProposalRepository,
		...CommandHandlers
	],
	exports: [
		ProposalSeederService
	]
})
export class ProposalModule {}
