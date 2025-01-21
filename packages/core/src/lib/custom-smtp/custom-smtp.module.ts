import { CqrsModule } from '@nestjs/cqrs';
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CustomSmtp } from './custom-smtp.entity';
import { CustomSmtpController } from './custom-smtp.controller';
import { CustomSmtpService } from './custom-smtp.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CommandHandlers } from './commands';
import { TypeOrmCustomSmtpRepository } from './repository/type-orm-custom-smtp.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([CustomSmtp]),
		MikroOrmModule.forFeature([CustomSmtp]),
		forwardRef(() => RolePermissionModule),
		CqrsModule
	],
	controllers: [CustomSmtpController],
	providers: [CustomSmtpService, TypeOrmCustomSmtpRepository, ...CommandHandlers],
	exports: [CustomSmtpService, TypeOrmCustomSmtpRepository]
})
export class CustomSmtpModule {}
