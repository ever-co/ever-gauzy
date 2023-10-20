import { forwardRef, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { EmailHistory } from './email-history.entity';
import { EmailHistoryController } from './email-history.controller';
import { TenantModule } from '../tenant/tenant.module';
import { UserModule } from './../user/user.module';
import { EmailHistoryService } from './email-history.service';
import { CommandHandlers } from './commands/handler';
import { EmailSendModule } from 'email-send/email-send.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/email', module: EmailHistoryModule }
		]),
		TypeOrmModule.forFeature([
			EmailHistory
		]),
		forwardRef(() => TenantModule),
		forwardRef(() => UserModule),
		forwardRef(() => EmailSendModule),
		CqrsModule,


	],
	controllers: [EmailHistoryController],
	providers: [
		EmailHistoryService,
		...CommandHandlers
	],
	exports: [
		TypeOrmModule,
		EmailHistoryService
	]
})
export class EmailHistoryModule { }
