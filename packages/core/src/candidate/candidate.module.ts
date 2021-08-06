import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { RouterModule } from 'nest-router';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CandidateController } from './candidate.controller';
import { CandidateService } from './candidate.service';
import { EmailModule, EmailService } from '../email';
import { AuthService } from '../auth/auth.service';
import { Candidate } from './candidate.entity';
import { UserOrganizationModule } from '../user-organization/user-organization.module';
import { CommandHandlers } from './commands/handlers';
import { TenantModule } from '../tenant/tenant.module';
import { UserModule } from './../user/user.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/candidate', module: CandidateModule }
		]),
		TypeOrmModule.forFeature([Candidate]),
		EmailModule,
		CqrsModule,
		UserOrganizationModule,
		TenantModule,
		UserModule
	],
	controllers: [CandidateController],
	providers: [
		CandidateService,
		AuthService,
		EmailService,
		...CommandHandlers
	],
	exports: [CandidateService]
})
export class CandidateModule {}
