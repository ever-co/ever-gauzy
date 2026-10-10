import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { KeyResultUpdateService } from './keyresult-update.service';
import { KeyResultUpdateController } from './keyresult-update.controller';
import { KeyResultUpdateResolver } from './keyresult-update.resolver';
import { KeyResultUpdate } from './keyresult-update.entity';
import { CommandHandlers } from './commands/handlers';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmKeyResultUpdateRepository } from './repository/type-orm-keyresult-update.repository';
import { MikroOrmKeyResultUpdateRepository } from './repository/mikro-orm-keyresult-update.repository';

/**
 * The moves a key result made.
 *
 * The resolver is declared here because a resolver can only inject services its own module can reach,
 * and this module is what reaches `KeyResultUpdateService`. `CqrsModule` is re-exported rather than
 * merely imported, and that is what makes the resolver's non-service dependency resolvable: the bulk
 * removal dispatches the same command the delivered route dispatches, and a resolver is a provider of
 * whichever module hosts the resolver graph, so that module receives the command bus only if this one
 * hands it on. `KeyResultUpdateService` is exported beside it for the fields that call the service
 * directly.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([KeyResultUpdate]),
		MikroOrmModule.forFeature([KeyResultUpdate]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [KeyResultUpdateController],
	providers: [
		KeyResultUpdateService,
		// The GraphQL view of the same resource.
		KeyResultUpdateResolver,
		TypeOrmKeyResultUpdateRepository,
		MikroOrmKeyResultUpdateRepository,
		...CommandHandlers
	],
	exports: [KeyResultUpdateService, CqrsModule]
})
export class KeyResultUpdateModule {}