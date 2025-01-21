import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CandidateInterviewers } from './candidate-interviewers.entity';
import { CandidateInterviewersService } from './candidate-interviewers.service';
import { CandidateInterviewersController } from './candidate-interviewers.controller';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmCandidateInterviewersRepository } from './repository/type-orm-candidate-interviewers.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([CandidateInterviewers]),
		MikroOrmModule.forFeature([CandidateInterviewers]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [CandidateInterviewersController],
	providers: [CandidateInterviewersService, TypeOrmCandidateInterviewersRepository, ...CommandHandlers]
})
export class CandidateInterviewersModule {}
