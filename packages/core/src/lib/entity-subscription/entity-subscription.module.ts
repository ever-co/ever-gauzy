import { CqrsModule } from '@nestjs/cqrs';
import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CommandHandlers } from './commands/handlers';
import { EventHandlers } from './events/handlers';
import { EntitySubscriptionService } from './entity-subscription.service';
import { EntitySubscriptionController } from './entity-subscription.controller';
import { EntitySubscriptionResolver } from './entity-subscription.resolver';
import { EntitySubscription } from './entity-subscription.entity';
import { TypeOrmEntitySubscriptionRepository } from './repository/type-orm-entity-subscription.repository';
import { MikroOrmEntitySubscriptionRepository } from './repository/mikro-orm-entity-subscription.repository';
import { EmployeeNotificationModule } from '../employee-notification/employee-notification.module';
import { EventBusModule } from '../event-bus/event-bus.module';
import { FollowerCommentFanOutHandler, FollowerFanOutService } from './fan-out';

/**
 * The subscriptions an employee holds against the records it wants to be told about.
 *
 * `CqrsModule` is re-exported, not merely imported, and that is what makes the resolver's second
 * dependency resolvable: a resolver is a provider of whichever module hosts the handler the Apollo
 * configuration names, so a module that imports this one receives the command bus only if this module
 * hands it on. The REST controller beside it resolves the bus from this module's own imports, which is
 * why nothing needed re-exporting until the GraphQL view of the same resource existed — and why the
 * subscribe field, which dispatches the command the route dispatches, is the entry that needs it.
 */
@Global()
@Module({
	imports: [
		TypeOrmModule.forFeature([EntitySubscription]),
		MikroOrmModule.forFeature([EntitySubscription]),
		RolePermissionModule,
		CqrsModule,
		// The followers are told through the notification service, from the task facts on the in-process bus.
		EmployeeNotificationModule,
		EventBusModule
	],
	controllers: [EntitySubscriptionController],
	providers: [
		EntitySubscriptionService,
		// Follower fan-out (off unless GAUZY_NOTIFICATION_FANOUT_ENABLED=true): comments and task changes reach followers.
		FollowerFanOutService,
		FollowerCommentFanOutHandler,
		// The GraphQL view of the same resource: declared here because a resolver can only inject the
		// services and the command bus its own module can reach, and this module is what reaches both.
		EntitySubscriptionResolver,
		TypeOrmEntitySubscriptionRepository,
		MikroOrmEntitySubscriptionRepository,
		...CommandHandlers,
		...EventHandlers
	],
	exports: [
		EntitySubscriptionService,
		TypeOrmEntitySubscriptionRepository,
		MikroOrmEntitySubscriptionRepository,
		// Handed on for the same reason: the resolver above dispatches a command, so the bus has to
		// leave this module with the services it works beside.
		CqrsModule
	]
})
export class EntitySubscriptionModule {}