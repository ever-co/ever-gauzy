import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { EmailHistory } from './email-history.entity';
import { EmailHistoryController } from './email-history.controller';
import { TenantModule } from '../tenant/tenant.module';
import { UserModule } from './../user/user.module';
import { EmailHistoryService } from './email-history.service';

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
	],
	controllers: [EmailHistoryController],
	providers: [
		EmailHistoryService
	],
	exports: [
		TypeOrmModule,
		EmailHistoryService
	]
})
export class EmailHistoryModule { }
