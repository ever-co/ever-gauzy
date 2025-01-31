import { Global, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { MentionService } from './mention.service';
import { SubscriptionModule } from '../subscription/subscription.module';
import { MentionController } from './mention.controller';
import { Mention } from './mention.entity';
import { EventHandlers } from './events/handlers';
import { TypeOrmMentionRepository } from './repository/type-orm-mention.repository';
import { UserNotificationModule } from '../user-notification/user-notification.module';

@Global()
@Module({
	imports: [
		TypeOrmModule.forFeature([Mention]),
		MikroOrmModule.forFeature([Mention]),
		CqrsModule,
		RolePermissionModule,
		SubscriptionModule,
		UserNotificationModule
	],
	controllers: [MentionController],
	providers: [MentionService, TypeOrmMentionRepository, ...EventHandlers],
	exports: [MentionService]
})
export class MentionModule {}
