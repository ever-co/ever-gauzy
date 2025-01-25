import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EmailSendModule } from './../email-send/email-send.module';
import { AuthModule } from './../auth/auth.module';
import { UserOrganizationModule } from '../user-organization/user-organization.module';
import { UserModule } from './../user/user.module';
import { EmployeeModule } from './../employee/employee.module';
import { RoleModule } from './../role/role.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CandidateController } from './candidate.controller';
import { CandidateService } from './candidate.service';
import { Candidate } from './candidate.entity';
import { TypeOrmCandidateRepository } from './repository/type-orm-candidate.repository';
import { CommandHandlers } from './commands/handlers';

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
	providers: [CandidateService, TypeOrmCandidateRepository, ...CommandHandlers],
	exports: [CandidateService, TypeOrmCandidateRepository]
})
export class CandidateModule {}
