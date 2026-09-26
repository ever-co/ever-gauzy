import { Global, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { MentionService } from './mention.service';
import { EntitySubscriptionModule } from '../entity-subscription/entity-subscription.module';
import { MentionController } from './mention.controller';
import { MentionResolver } from './mention.resolver';
import { Mention } from './mention.entity';
import { EventHandlers } from './events/handlers';
import { TypeOrmMentionRepository } from './repository/type-orm-mention.repository';
import { MikroOrmMentionRepository } from './repository/mikro-orm-mention.repository';
import { EmployeeNotificationModule } from '../employee-notification/employee-notification.module';

@Global()
@Module({
	imports: [
		TypeOrmModule.forFeature([Mention]),
		MikroOrmModule.forFeature([Mention]),
		CqrsModule,
		RolePermissionModule,
		EntitySubscriptionModule,
		EmployeeNotificationModule
	],
	controllers: [MentionController],
	providers: [
		MentionService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject the
		// services its own module can reach, and this module is what reaches the mention service. Nothing
		// else has to leave the module for it — the resolver injects no command bus, so the `CqrsModule`
		// this module already imports is not re-exported.
		MentionResolver,
		TypeOrmMentionRepository,
		MikroOrmMentionRepository,
		...EventHandlers
	],
	exports: [MentionService]
})
export class MentionModule {}