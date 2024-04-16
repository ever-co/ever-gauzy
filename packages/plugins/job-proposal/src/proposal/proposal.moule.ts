import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '@gauzy/core';
import { Proposal } from './proposal.entity';
import { ProposalController } from './proposal.controller';
import { ProposalService } from './proposal.service';
import { CommandHandlers } from './commands/handlers';

@Module({
    imports: [
        TypeOrmModule.forFeature([Proposal]),
        MikroOrmModule.forFeature([Proposal]),
        RolePermissionModule,
        CqrsModule
    ],
    controllers: [ProposalController],
    providers: [ProposalService, ...CommandHandlers],
    exports: [ProposalService]
})
export class ProposalModule { }
