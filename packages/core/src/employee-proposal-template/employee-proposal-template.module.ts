import { forwardRef, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { EmployeeProposalTemplateController } from './employee-proposal-template.controller';
import { EmployeeProposalTemplate } from './employee-proposal-template.entity';
import { EmployeeProposalTemplateService } from './employee-proposal-template.service';

@Module({
	imports: [
		RouterModule.register([{ path: '/employee-proposal-template', module: EmployeeProposalTemplateModule }]),
		TypeOrmModule.forFeature([EmployeeProposalTemplate]),
		MikroOrmModule.forFeature([EmployeeProposalTemplate]),
		forwardRef(() => RolePermissionModule),
		CqrsModule
	],
	controllers: [EmployeeProposalTemplateController],
	providers: [EmployeeProposalTemplateService],
	exports: [TypeOrmModule, MikroOrmModule, EmployeeProposalTemplateService]
})
export class EmployeeProposalTemplateModule { }
