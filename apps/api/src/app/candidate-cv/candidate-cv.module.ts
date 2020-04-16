import { EmailModule } from './../email/email.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs/dist/cqrs.module';
import { CandidateCv } from './candidate-cv.entity';
import { CandidateCvService } from './candidate-cv.service';
import { UserService } from '../user/user.service';
import { User } from '../user/user.entity';
import { UserOrganizationModule } from '../user-organization/user-organization.module';
import { AuthService } from '../auth/auth.service';
import { EmailService } from '../email';
import { CandidateCvController } from './candidate-cv.controller';

@Module({
	imports: [
		TypeOrmModule.forFeature([CandidateCv, User]),
		CqrsModule,
		UserOrganizationModule,
		EmailModule
	],
	providers: [CandidateCvService, UserService, AuthService, EmailService],
	controllers: [CandidateCvController],
	exports: [CandidateCvService]
})
export class CandidateCvModule {}
