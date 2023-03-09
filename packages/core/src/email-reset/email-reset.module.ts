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
import { EmailModule } from './../email/email.module';
import { EmployeeModule } from './../employee/employee.module';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			EmailReset
		]),
		forwardRef(() => TenantModule),
		CqrsModule,
		UserModule,
		EmailModule,
		EmployeeModule
	],
	providers: [
		EmailResetService,
		...CommandHandlers,
		...QueryHandlers
	],
	exports: [
		TypeOrmModule,
		EmailResetService
	],
	controllers: [EmailResetController]
})
export class EmailResetModule { }
