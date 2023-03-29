import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantModule } from './../../tenant/tenant.module';
import { IssueTypeController } from './issue-type.controller';
import { IssueType } from './issue-type.entity';
import { IssueTypeService } from './issue-type.service';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/issue-types', module: IssueTypeModule }
		]),
		TypeOrmModule.forFeature([
			IssueType
		]),
		CqrsModule,
		TenantModule
	],
	controllers: [
		IssueTypeController
	],
	providers: [
		IssueTypeService
	],
	exports: [],
})
export class IssueTypeModule { }
