import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from '../user/user.service';
import { User } from '../user/user.entity';
import { CandidateInterviewers } from './candidate-interviewers.entity';
import { CandidateInterviewersService } from './candidate-interviewers.service';
import { CandidateInterviewersController } from './candidate-interviewers.controller';

@Module({
	imports: [TypeOrmModule.forFeature([CandidateInterviewers, User])],
	providers: [CandidateInterviewersService, UserService],
	controllers: [CandidateInterviewersController],
	exports: [CandidateInterviewersService]
})
export class CandidateInterviewersModule {}
