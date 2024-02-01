import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantModule } from './../../tenant/tenant.module';
import { IssueTypeController } from './issue-type.controller';
import { IssueType } from './issue-type.entity';
import { IssueTypeService } from './issue-type.service';
import { CommandHandlers } from './commands/handlers';
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Module({
	imports: [
		RouterModule.register([{ path: '/issue-types', module: IssueTypeModule }]),
		TypeOrmModule.forFeature([IssueType]),
		MikroOrmModule.forFeature([IssueType]),
		CqrsModule,
		TenantModule
	],
	controllers: [IssueTypeController],
	providers: [IssueTypeService, ...CommandHandlers],
	exports: []
})
export class IssueTypeModule { }
