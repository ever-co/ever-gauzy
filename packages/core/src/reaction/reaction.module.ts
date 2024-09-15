import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
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
		RouterModule.register([{ path: '/reaction', module: ReactionModule }]),
		TypeOrmModule.forFeature([Reaction]),
		MikroOrmModule.forFeature([Reaction]),
		RolePermissionModule,
		UserModule,
		CqrsModule
	],
	providers: [ReactionService, TypeOrmReactionRepository, ...CommandHandlers],
	controllers: [ReactionController],
	exports: [ReactionService, TypeOrmModule, TypeOrmReactionRepository]
})
export class ReactionModule {}
