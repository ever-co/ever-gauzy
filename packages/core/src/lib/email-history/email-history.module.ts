import { forwardRef, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EmailHistory } from './email-history.entity';
import { EmailHistoryController } from './email-history.controller';
import { EmailHistoryResolver } from './email-history.resolver';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { EmailHistoryService } from './email-history.service';
import { CommandHandlers } from './commands/handler';
import { EmailSendModule } from './../email-send/email-send.module';
import { TypeOrmEmailHistoryRepository } from './repository/type-orm-email-history.repository';
import { MikroOrmEmailHistoryRepository } from './repository/mikro-orm-email-history.repository';

/**
 * The sent-message ledger.
 *
 * `CqrsModule` is re-exported, not merely imported, and that is what makes the resolver's non-service
 * dependency resolvable: a resolver is a provider of whichever module the Apollo configuration names, so
 * a module that imports this one receives the command bus only if this module hands it on. The REST
 * controller beside it resolves the bus from this module's own imports, which is why nothing needed
 * re-exporting until the GraphQL view of the same resource existed.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([EmailHistory]),
		MikroOrmModule.forFeature([EmailHistory]),
		forwardRef(() => RolePermissionModule),
		forwardRef(() => EmailSendModule),
		CqrsModule
	],
	controllers: [EmailHistoryController],
	providers: [
		EmailHistoryService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		EmailHistoryResolver,
		TypeOrmEmailHistoryRepository,
		MikroOrmEmailHistoryRepository,
		...CommandHandlers
	],
	exports: [EmailHistoryService, TypeOrmEmailHistoryRepository, MikroOrmEmailHistoryRepository, CqrsModule]
})
export class EmailHistoryModule {}