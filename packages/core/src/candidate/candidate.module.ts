import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CandidateController } from './candidate.controller';
import { CandidateService } from './candidate.service';
import { EmailSendModule } from './../email-send/email-send.module';
import { AuthModule } from './../auth/auth.module';
import { Candidate } from './candidate.entity';
import { UserOrganizationModule } from '../user-organization/user-organization.module';
import { CommandHandlers } from './commands/handlers';
import { UserModule } from './../user/user.module';
import { EmployeeModule } from './../employee/employee.module';
import { RoleModule } from './../role/role.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';

@Module({
	imports: [
		TypeOrmModule.forFeature([Candidate]),
		MikroOrmModule.forFeature([Candidate]),
		EmailSendModule,
		CqrsModule,
		UserOrganizationModule,
		UserModule,
		EmployeeModule,
		RoleModule,
		RolePermissionModule,
		AuthModule
	],
	controllers: [CandidateController],
	providers: [CandidateService, ...CommandHandlers],
	exports: [TypeOrmModule, MikroOrmModule, CandidateService]
})
export class CandidateModule {}
