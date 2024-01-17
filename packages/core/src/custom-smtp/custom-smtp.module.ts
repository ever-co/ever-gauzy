import { TypeOrmModule } from '@nestjs/typeorm';
import { forwardRef, Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { CustomSmtp } from './custom-smtp.entity';
import { CustomSmtpController } from './custom-smtp.controller';
import { CustomSmtpService } from './custom-smtp.service';
import { TenantModule } from '../tenant/tenant.module';
import { UserModule } from './../user/user.module';
import { CommandHandlers } from './commands';
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Module({
	imports: [
		RouterModule.register([{ path: '/smtp', module: CustomSmtpModule }]),
		TypeOrmModule.forFeature([CustomSmtp]),
		MikroOrmModule.forFeature([CustomSmtp]),
		forwardRef(() => TenantModule),
		forwardRef(() => UserModule),
		CqrsModule
	],
	controllers: [CustomSmtpController],
	providers: [CustomSmtpService, ...CommandHandlers],
	exports: [TypeOrmModule, CustomSmtpService]
})
export class CustomSmtpModule { }
