import { CqrsModule } from '@nestjs/cqrs';
import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CommandHandlers } from './commands/handlers';
import { EventHandlers } from './events/handlers';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import { Subscription } from './subscription.entity';
import { TypeOrmSubscriptionRepository } from './repository/type-orm-subscription.repository';

@Global()
@Module({
	imports: [
		TypeOrmModule.forFeature([Subscription]),
		MikroOrmModule.forFeature([Subscription]),
		RolePermissionModule,
		CqrsModule
	],
	providers: [SubscriptionService, TypeOrmSubscriptionRepository, ...CommandHandlers, ...EventHandlers],
	controllers: [SubscriptionController],
	exports: [SubscriptionService, TypeOrmSubscriptionRepository]
})
export class SubscriptionModule {}
