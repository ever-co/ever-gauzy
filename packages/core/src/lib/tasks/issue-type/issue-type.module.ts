import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { IssueTypeController } from './issue-type.controller';
import { IssueType } from './issue-type.entity';
import { IssueTypeService } from './issue-type.service';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmIssueTypeRepository } from './repository/type-orm-issue-type.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([IssueType]),
		MikroOrmModule.forFeature([IssueType]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [IssueTypeController],
	providers: [IssueTypeService, TypeOrmIssueTypeRepository, ...CommandHandlers]
})
export class IssueTypeModule {}
