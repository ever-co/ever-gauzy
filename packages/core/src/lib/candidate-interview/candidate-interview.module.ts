import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CandidateInterviewService } from './candidate-interview.service';
import { CandidateInterviewController } from './candidate-interview.controller';
import { CandidateInterviewResolver } from './candidate-interview.resolver';
import { CandidateInterviewVocabularyResolver } from './candidate-interview-vocabulary.resolver';
import { CandidateInterview } from './candidate-interview.entity';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CandidateTechnologiesModule } from './../candidate-technologies/candidate-technologies.module';
import { CandidatePersonalQualitiesModule } from './../candidate-personal-qualities/candidate-personal-qualities.module';
import { TypeOrmCandidateInterviewRepository } from './repository/type-orm-candidate-interview.repository';
import { MikroOrmCandidateInterviewRepository } from './repository/mikro-orm-candidate-interview.repository';

/**
 * The sitting, and the vocabulary it is assessed against.
 *
 * **Two GraphQL views are declared here, and the second is the reason this module imports two more.** The
 * sitting's own resolver belongs beside the service it calls, which this module already provides. The
 * vocabulary resolver — the technologies and the personal qualities, which are one shape and are served
 * by one class — calls two services this module does not provide, so the two modules that do are imported
 * here: a resolver can only inject what its own module can reach, and the sitting is what both rows hang
 * off. Those two modules import neither this one nor each other, so no cycle is added; both already
 * export their services, so neither needed changing.
 *
 * `CqrsModule` is re-exported, not merely imported, because the vocabulary resolver dispatches the
 * three bulk writes through the bus and a module's imports are not inherited by the module that imports
 * it: the module that hosts the resolver has to reach the bus itself.
 *
 * The additions are two providers, one import and one export. No provider, route or dependency changed.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([CandidateInterview]),
		MikroOrmModule.forFeature([CandidateInterview]),
		RolePermissionModule,
		CqrsModule,
		CandidateTechnologiesModule,
		CandidatePersonalQualitiesModule
	],
	providers: [
		CandidateInterviewService,
		// The GraphQL views of the sitting and of the vocabulary it carries: declared here because a
		// resolver can only inject services its own module can reach, and this module is what reaches them.
		CandidateInterviewResolver,
		CandidateInterviewVocabularyResolver,
		TypeOrmCandidateInterviewRepository,
		MikroOrmCandidateInterviewRepository
	],
	controllers: [CandidateInterviewController],
	exports: [CandidateInterviewService, CqrsModule]
})
export class CandidateInterviewModule {}