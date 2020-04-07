import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { CandidateController } from './candidate.controller';
import { CandidateService } from './candidate.service';
import { EmailModule, EmailService } from '../email';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { AuthService } from '../auth/auth.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Candidate } from './candidate.entity';
import { UserOrganizationModule } from '../user-organization/user-organization.module';

@Module({
	imports: [
		TypeOrmModule.forFeature([Candidate, User]),
		EmailModule,
		CqrsModule,
		UserOrganizationModule
	],
	controllers: [CandidateController],
	providers: [CandidateService, UserService, AuthService, EmailService],
	exports: [CandidateService]
})
export class CandidateModule {}
