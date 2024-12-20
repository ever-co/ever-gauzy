import { CqrsModule } from '@nestjs/cqrs';
import { forwardRef, Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CustomSmtp } from './custom-smtp.entity';
import { CustomSmtpController } from './custom-smtp.controller';
import { CustomSmtpService } from './custom-smtp.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CommandHandlers } from './commands';

@Module({
	imports: [
		RouterModule.register([
			{ path: '/smtp', module: CustomSmtpModule }
		]),
		TypeOrmModule.forFeature([CustomSmtp]),
		MikroOrmModule.forFeature([CustomSmtp]),
		forwardRef(() => RolePermissionModule),
		CqrsModule
	],
	controllers: [CustomSmtpController],
	providers: [CustomSmtpService, ...CommandHandlers],
	exports: [TypeOrmModule, MikroOrmModule, CustomSmtpService]
})
export class CustomSmtpModule { }
