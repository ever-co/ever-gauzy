import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { UserModule } from '../user/user.module';
import { CommandHandlers } from './commands/handlers';
import { ReactionService } from './reaction.service';
import { ReactionController } from './reaction.controller';
import { Reaction } from './reaction.entity';
import { TypeOrmReactionRepository } from './repository/type-orm-reaction.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([Reaction]),
		MikroOrmModule.forFeature([Reaction]),
		RolePermissionModule,
		UserModule,
		CqrsModule
	],
	controllers: [ReactionController],
	providers: [ReactionService, TypeOrmReactionRepository, ...CommandHandlers],
	exports: [ReactionService, TypeOrmReactionRepository]
})
export class ReactionModule {}
