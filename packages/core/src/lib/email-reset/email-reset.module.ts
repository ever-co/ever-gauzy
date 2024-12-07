import { forwardRef, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CommandHandlers } from './commands/handlers';
import { QueryHandlers } from './queries/handlers';
import { EmailReset } from './email-reset.entity';
import { EmailResetService } from './email-reset.service';
import { EmailResetController } from './email-reset.controller';
import { UserModule } from '../user/user.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { EmailSendModule } from './../email-send/email-send.module';
import { EmployeeModule } from './../employee/employee.module';
import { AuthModule } from './../auth/auth.module';

@Module({
	imports: [
		TypeOrmModule.forFeature([EmailReset]),
		MikroOrmModule.forFeature([EmailReset]),
		forwardRef(() => RolePermissionModule),
		CqrsModule,
		UserModule,
		EmailSendModule,
		EmployeeModule,
		AuthModule
	],
	controllers: [EmailResetController],
	providers: [EmailResetService, ...CommandHandlers, ...QueryHandlers],
	exports: [TypeOrmModule, MikroOrmModule, EmailResetService],
})
export class EmailResetModule { }
