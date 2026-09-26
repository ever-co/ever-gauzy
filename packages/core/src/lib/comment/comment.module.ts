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
import { CommentResolver } from './comment.resolver';
import { Comment } from './comment.entity';
import { TypeOrmCommentRepository } from './repository/type-orm-comment.repository';
import { MikroOrmCommentRepository } from './repository/mikro-orm-comment.repository';

/**
 * The comment.
 *
 * `CqrsModule` is re-exported, not merely imported, and that is what makes the resolver's non-service
 * dependency resolvable: a resolver is a provider of whichever module hosts the handler the Apollo
 * configuration names, so a module that imports this one receives the command bus only if this module
 * hands it on. The REST controller beside it resolves the bus from this module's own imports, which is
 * why nothing needed re-exporting until the GraphQL view of the same resource existed.
 */
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
	providers: [
		CommentService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		CommentResolver,
		TypeOrmCommentRepository,
		MikroOrmCommentRepository,
		...CommandHandlers
	],
	exports: [CqrsModule]
})
export class CommentModule {}