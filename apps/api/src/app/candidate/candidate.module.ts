import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { CandidateController } from './candidate.controller';
import { CandidateService } from './candidate.service';
import { EmailModule, EmailService } from '../email';
import { UserService, User } from '../user';
import { AuthService } from '../auth';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Candidate } from './candidate.entity';

@Module({
	imports: [
		TypeOrmModule.forFeature([Candidate, User]),
		EmailModule,
		CqrsModule
	],
	controllers: [CandidateController],
	providers: [CandidateService, UserService, AuthService, EmailService],
	exports: [CandidateService]
})
export class CandidateModule {}
