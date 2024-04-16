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
import { TypeOrmProposalRepository } from './repository';

@Module({
    imports: [
        TypeOrmModule.forFeature([Proposal]),
        MikroOrmModule.forFeature([Proposal]),
        RolePermissionModule,
        SeederModule,
        CqrsModule
    ],
    controllers: [ProposalController],
    providers: [ProposalService, ProposalSeederService, TypeOrmProposalRepository, ...CommandHandlers],
    exports: [ProposalSeederService]
})
export class ProposalModule { }
