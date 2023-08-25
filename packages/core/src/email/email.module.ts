import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { Email } from './email.entity';
import { EmailController } from './email.controller';
import { TenantModule } from '../tenant/tenant.module';
import { UserModule } from './../user/user.module';
import { EmailHistoryService } from './email-history.service';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/email', module: EmailModule }
		]),
		TypeOrmModule.forFeature([
			Email
		]),
		forwardRef(() => TenantModule),
		forwardRef(() => UserModule),
	],
	controllers: [EmailController],
	providers: [
		EmailHistoryService
	],
	exports: [
		TypeOrmModule,
		EmailHistoryService
	]
})
export class EmailModule { }
