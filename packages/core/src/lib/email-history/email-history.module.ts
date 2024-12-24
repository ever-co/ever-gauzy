import { forwardRef, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EmailHistory } from './email-history.entity';
import { EmailHistoryController } from './email-history.controller';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { EmailHistoryService } from './email-history.service';
import { CommandHandlers } from './commands/handler';
import { EmailSendModule } from './../email-send/email-send.module';
import { TypeOrmEmailHistoryRepository } from './repository/type-orm-email-history.repository';

@Module({
	imports: [
		RouterModule.register([{ path: '/email', module: EmailHistoryModule }]),
		TypeOrmModule.forFeature([EmailHistory]),
		MikroOrmModule.forFeature([EmailHistory]),
		forwardRef(() => RolePermissionModule),
		forwardRef(() => EmailSendModule),
		CqrsModule
	],
	controllers: [EmailHistoryController],
	providers: [EmailHistoryService, TypeOrmEmailHistoryRepository, ...CommandHandlers],
	exports: [TypeOrmModule, MikroOrmModule, EmailHistoryService, TypeOrmEmailHistoryRepository]
})
export class EmailHistoryModule {}
