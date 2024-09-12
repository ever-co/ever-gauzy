import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { EmployeeModule } from '../employee/employee.module';
import { CommandHandlers } from './commands/handlers';
import { CommentService } from './comment.service';
import { CommentController } from './comment.controller';
import { Comment } from './comment.entity';
import { TypeOrmCommentRepository } from './repository/type-orm.comment.repository';

@Module({
	imports: [
		RouterModule.register([{ path: '/comment', module: CommentModule }]),
		TypeOrmModule.forFeature([Comment]),
		MikroOrmModule.forFeature([Comment]),
		RolePermissionModule,
		EmployeeModule,
		CqrsModule
	],
	providers: [CommentService, TypeOrmCommentRepository, ...CommandHandlers],
	controllers: [CommentController],
	exports: [CommentService, TypeOrmModule, TypeOrmCommentRepository]
})
export class CommentModule {}
