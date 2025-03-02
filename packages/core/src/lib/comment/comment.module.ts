import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { MentionModule } from '../mention/mention.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { EmployeeModule } from '../employee/employee.module';
import { CommandHandlers } from './commands/handlers';
import { CommentService } from './comment.service';
import { CommentController } from './comment.controller';
import { Comment } from './comment.entity';
import { TypeOrmCommentRepository } from './repository/type-orm.comment.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([Comment]),
		MikroOrmModule.forFeature([Comment]),
		RolePermissionModule,
		EmployeeModule,
		MentionModule,
		CqrsModule
	],
	controllers: [CommentController],
	providers: [CommentService, TypeOrmCommentRepository, ...CommandHandlers]
})
export class CommentModule {}
