import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantModule } from './../../tenant/tenant.module';
import { TaskLinkedIssue } from './task-linked-issue.entity';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			TaskLinkedIssue
		]),
		TenantModule,
		CqrsModule
	],
	controllers: [],
	providers: [],
	exports: [],
})
export class TaskLinkedIssueModule { }
