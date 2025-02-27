import { CqrsModule } from '@nestjs/cqrs';
import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CommandHandlers } from './commands/handlers';
import { EventHandlers } from './events/handlers';
import { EntitySubscriptionService } from './entity-subscription.service';
import { EntitySubscriptionController } from './entity-subscription.controller';
import { EntitySubscription } from './entity-subscription.entity';
import { TypeOrmEntitySubscriptionRepository } from './repository/type-orm-entity-subscription.repository';

@Global()
@Module({
	imports: [
		TypeOrmModule.forFeature([EntitySubscription]),
		MikroOrmModule.forFeature([EntitySubscription]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [EntitySubscriptionController],
	providers: [EntitySubscriptionService, TypeOrmEntitySubscriptionRepository, ...CommandHandlers, ...EventHandlers],
	exports: [EntitySubscriptionService, TypeOrmEntitySubscriptionRepository]
})
export class EntitySubscriptionModule {}
