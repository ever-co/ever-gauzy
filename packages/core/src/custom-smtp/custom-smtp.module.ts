import { TypeOrmModule } from '@nestjs/typeorm';
import { forwardRef, Module } from '@nestjs/common';
import { RouterModule } from 'nest-router';
import { CqrsModule } from '@nestjs/cqrs';
import { CustomSmtp } from './custom-smtp.entity';
import { CustomSmtpController } from './custom-smtp.controller';
import { CustomSmtpService } from './custom-smtp.service';
import { TenantModule } from '../tenant/tenant.module';
import { UserModule } from './../user/user.module';
import { CommandHandlers } from './commands';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/smtp', module: CustomSmtpModule }
		]),
		TypeOrmModule.forFeature([CustomSmtp]),
		forwardRef(() => TenantModule),
		forwardRef(() => UserModule),
		CqrsModule
	],
	controllers: [CustomSmtpController],
	providers: [CustomSmtpService, ...CommandHandlers],
	exports: [TypeOrmModule, CustomSmtpService]
})
export class CustomSmtpModule {}