import { forwardRef, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommandHandlers } from './commands/handlers';
import { QueryHandlers } from './queries/handlers';
import { EmailReset } from './email-reset.entity';
import { EmailResetService } from './email-reset.service';
import { EmailResetController } from './email-reset.controller';
import { UserModule } from '../user/user.module';
import { TenantModule } from '../tenant/tenant.module';
import { EmailSendModule } from './../email-send/email-send.module';
import { EmployeeModule } from './../employee/employee.module';
import { AuthModule } from './../auth/auth.module';

@Module({
	imports: [
		TypeOrmModule.forFeature([EmailReset]),
		forwardRef(() => TenantModule),
		CqrsModule,
		UserModule,
		EmailSendModule,
		EmployeeModule,
		AuthModule
	],
	providers: [EmailResetService, ...CommandHandlers, ...QueryHandlers],
	exports: [TypeOrmModule, EmailResetService],
	controllers: [EmailResetController]
})
export class EmailResetModule { }
