import { forwardRef, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CommandHandlers } from './commands/handlers';
import { QueryHandlers } from './queries/handlers';
import { EmailReset } from './email-reset.entity';
import { EmailResetService } from './email-reset.service';
import { EmailResetController } from './email-reset.controller';
import { EmailResetResolver } from './email-reset.resolver';
import { UserModule } from '../user/user.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { EmailSendModule } from './../email-send/email-send.module';
import { EmployeeModule } from './../employee/employee.module';
import { AuthModule } from './../auth/auth.module';
import { TypeOrmEmailResetRepository } from './repository/type-orm-email-reset.repository';
import { MikroOrmEmailResetRepository } from './repository/mikro-orm-email-reset.repository';

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
	providers: [
		EmailResetService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them. It injects the
		// service and nothing else — both fields call the methods the two routes call, and the buses
		// those methods dispatch through are this module's own, resolved beside it.
		EmailResetResolver,
		TypeOrmEmailResetRepository,
		MikroOrmEmailResetRepository,
		...CommandHandlers,
		...QueryHandlers
	],
	exports: [EmailResetService]
})
export class EmailResetModule {}