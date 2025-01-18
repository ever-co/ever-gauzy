import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { TaskRelatedIssueType } from './related-issue-type.entity';
import { TaskRelatedIssueTypeController } from './related-issue-type.controller';
import { TaskRelatedIssueTypeService } from './related-issue-type.service';
import { CommandHandlers } from './commands/handlers';
import { QueryHandlers } from './queries/handlers';
import { TypeOrmTaskRelatedIssueTypeRepository } from './repository/type-orm-related-issue-type.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([TaskRelatedIssueType]),
		MikroOrmModule.forFeature([TaskRelatedIssueType]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [TaskRelatedIssueTypeController],
	providers: [
		TaskRelatedIssueTypeService,
		TypeOrmTaskRelatedIssueTypeRepository,
		...QueryHandlers,
		...CommandHandlers
	]
})
export class TaskRelatedIssueTypeModule {}
