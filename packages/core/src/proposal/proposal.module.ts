import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Proposal } from './proposal.entity';
import { ProposalController } from './proposal.controller';
import { ProposalService } from './proposal.service';
import { Employee } from '../employee/employee.entity';
import { CommandHandlers } from './commands/handlers';
import { RolePermissionModule } from '../role-permission/role-permission.module';

@Module({
	imports: [
		RouterModule.register([{ path: '/proposal', module: ProposalModule }]),
		TypeOrmModule.forFeature([Proposal, Employee]),
		MikroOrmModule.forFeature([Proposal, Employee]),
		RolePermissionModule
	],
	controllers: [ProposalController],
	providers: [ProposalService, ...CommandHandlers],
	exports: [ProposalService]
})
export class ProposalModule { }
