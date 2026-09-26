import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CandidateInterviewers } from './candidate-interviewers.entity';
import { CandidateInterviewersService } from './candidate-interviewers.service';
import { CandidateInterviewersController } from './candidate-interviewers.controller';
import { CandidateInterviewersResolver } from './candidate-interviewers.resolver';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmCandidateInterviewersRepository } from './repository/type-orm-candidate-interviewers.repository';
import { MikroOrmCandidateInterviewersRepository } from './repository/mikro-orm-candidate-interviewers.repository';

/**
 * The panel of one sitting.
 *
 * **The GraphQL view of the same resource is declared here, beside the service it calls.** The service is
 * already a provider, so its own dependency needed nothing new of the module; the command bus the three
 * panel writes dispatch through did, and it is re-exported rather than merely imported: a module's
 * imports are not inherited by the module that imports it, so the module that hosts the resolver has to
 * reach the bus itself.
 *
 * The addition is one provider and one export. No provider, route or dependency changed.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([CandidateInterviewers]),
		MikroOrmModule.forFeature([CandidateInterviewers]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [CandidateInterviewersController],
	providers: [
		CandidateInterviewersService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		CandidateInterviewersResolver,
		TypeOrmCandidateInterviewersRepository,
		MikroOrmCandidateInterviewersRepository,
		...CommandHandlers
	],
	exports: [CandidateInterviewersService, CqrsModule]
})
export class CandidateInterviewersModule {}