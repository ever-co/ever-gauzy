import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { RouterModule } from 'nest-router';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CandidateController } from './candidate.controller';
import { CandidateService } from './candidate.service';
import { EmailModule, EmailService } from '../email';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { AuthService } from '../auth/auth.service';
import { Candidate } from './candidate.entity';
import { UserOrganizationModule } from '../user-organization/user-organization.module';
import { CommandHandlers } from './commands/handlers';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/candidate', module: CandidateModule }
		]),
		TypeOrmModule.forFeature([Candidate, User]),
		EmailModule,
		CqrsModule,
		UserOrganizationModule,
		TenantModule
	],
	controllers: [CandidateController],
	providers: [
		CandidateService,
		UserService,
		AuthService,
		EmailService,
		...CommandHandlers
	],
	exports: [CandidateService]
})
export class CandidateModule {}
