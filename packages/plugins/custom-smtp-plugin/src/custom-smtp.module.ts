import { TypeOrmModule } from '@nestjs/typeorm';
import { forwardRef, Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { TenantModule, UserModule } from '@gauzy/core';
import { CustomSmtp } from './custom-smtp.entity';
import { CustomSmtpController } from './custom-smtp.controller';
import { CustomSmtpService } from './custom-smtp.service';
import { CommandHandlers } from './commands';

@Module({
	imports: [
		RouterModule.register([
			{ path: '/smtp', module: CustomSmtpModule }
		]),
		TypeOrmModule.forFeature([
			CustomSmtp
		]),
		forwardRef(() => TenantModule),
		forwardRef(() => UserModule),
		CqrsModule
	],
	controllers: [CustomSmtpController],
	providers: [CustomSmtpService, ...CommandHandlers],
	exports: [TypeOrmModule, CustomSmtpService]
})
export class CustomSmtpModule { }
