import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '@gauzy/core';
import { EmployeeProposalTemplateController } from './employee-proposal-template.controller';
import { EmployeeProposalTemplate } from './employee-proposal-template.entity';
import { EmployeeProposalTemplateService } from './employee-proposal-template.service';
import { TypeOrmEmployeeProposalTemplateRepository } from './repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([EmployeeProposalTemplate]),
		MikroOrmModule.forFeature([EmployeeProposalTemplate]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [EmployeeProposalTemplateController],
	providers: [EmployeeProposalTemplateService, TypeOrmEmployeeProposalTemplateRepository],
	exports: []
})
export class EmployeeProposalTemplateModule { }
