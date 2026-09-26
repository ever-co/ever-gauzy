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
import { CandidateDocumentsModule } from './../candidate-documents/candidate-documents.module';
import { CandidateEducationModule } from './../candidate-education/candidate-education.module';
import { CandidateExperienceModule } from './../candidate-experience/candidate-experience.module';
import { CandidateSkillModule } from './../candidate-skill/candidate-skill.module';
import { CandidateSourceModule } from './../candidate-source/candidate-source.module';
import { CandidateController } from './candidate.controller';
import { CandidateResolver } from './candidate.resolver';
import { CandidateProfileResolver } from './candidate-profile.resolver';
import { CandidateService } from './candidate.service';
import { Candidate } from './candidate.entity';
import { TypeOrmCandidateRepository } from './repository/type-orm-candidate.repository';
import { MikroOrmCandidateRepository } from './repository/mikro-orm-candidate.repository';
import { CommandHandlers } from './commands/handlers';

/**
 * The candidacy: one person's record in one organization's hiring pipeline, and the file beside it.
 *
 * **The GraphQL view of the same resource is declared here, beside the services it calls**, because a
 * resolver is an ordinary Nest provider and can only inject what the module hosting it can reach.
 * `CandidateService` is already a provider and already exported, so the aggregate's own resolver needed
 * nothing new of it; the command bus it dispatches five of its writes through did, and it is re-exported
 * rather than merely imported: a module's imports are not inherited by the module that imports it, so the
 * module that hosts the resolver has to reach the bus itself.
 *
 * **The file beside the candidacy is served from here too, and that is why five modules are imported.**
 * The documents, the studies, the work, the skills and the origins are one shape repeated, so they are
 * one resolver — `CandidateProfileResolver` — and a resolver can only inject what its own module can
 * reach. Each of the five modules therefore exports the service it already provides, and this module
 * imports all five; nothing else about them changed, and the direction of the dependency is unchanged —
 * this module imports them and none of them imports this one, so no cycle is added.
 *
 * The addition is two providers, five imports and one export. No provider, route or dependency changed.
 */
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
		AuthModule,
		// The five modules that own the rows a candidacy's file is made of. They are imported so the
		// resolver above can reach their services, which each of them exports for that reason.
		CandidateDocumentsModule,
		CandidateEducationModule,
		CandidateExperienceModule,
		CandidateSkillModule,
		CandidateSourceModule
	],
	controllers: [CandidateController],
	providers: [
		CandidateService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		CandidateResolver,
		CandidateProfileResolver,
		TypeOrmCandidateRepository,
		MikroOrmCandidateRepository,
		...CommandHandlers
	],
	exports: [CandidateService, CqrsModule, TypeOrmCandidateRepository, MikroOrmCandidateRepository]
})
export class CandidateModule {}
