import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { JobExecution } from './job-execution.entity';
import { JobExecutionService } from './job-execution.service';
import { TypeOrmJobExecutionRepository } from './repository/type-orm-job-execution.repository';
import { MikroOrmJobExecutionRepository } from './repository/mikro-orm-job-execution.repository';
import { JobDeadLetter } from '../job-dead-letter/job-dead-letter.entity';
import { JobDeadLetterService } from '../job-dead-letter/job-dead-letter.service';
import { TypeOrmJobDeadLetterRepository } from '../job-dead-letter/repository/type-orm-job-dead-letter.repository';
import { MikroOrmJobDeadLetterRepository } from '../job-dead-letter/repository/mikro-orm-job-dead-letter.repository';

/**
 * The job runtime: the scheduler's run ledger and its dead-letter store, as one capability.
 *
 * **One module for the two tables, because they are one subject.** A run that ends well leaves a
 * ledger row; a run that ends badly and has no attempts left leaves a dead-letter row as well. Every
 * consumer that wants one of them wants the other — the operator surface that lists jobs and their
 * last outcome, the queue listing that reports a dead-letter depth beside its counts, the health
 * surface that reads stale runs. Splitting them into two modules would give every such consumer two
 * imports and would put the repositories of one table in a module the other one re-declares.
 *
 * **Both ORMs are registered**, because the kernel is dual-ORM: the entity decorators map the two
 * tables for whichever mapper the deployment runs, and each repository pair is provided here so a
 * service injected with one is resolved from the module that declares its table rather than from
 * whichever module happens to import this one first.
 *
 * **The repository classes are exported as well as the services.** A consumer that composes the two
 * tables itself — a retention sweep, a diagnostics read that must not go through the service's own
 * rules — needs the same repository the services write through, and re-providing it elsewhere would
 * give it a second instance over the same table.
 *
 * **`RolePermissionModule` is imported for the guards rather than for a service.** This module owns no
 * HTTP handler today, and no controller or resolver is added by the set that delivers these tables; a
 * guard is a provider of whichever module hosts the handler it protects, so importing it here is what
 * makes this module the one place a later handler is added rather than a second edit that change has
 * to remember.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([JobExecution, JobDeadLetter]),
		MikroOrmModule.forFeature([JobExecution, JobDeadLetter]),
		RolePermissionModule
	],
	providers: [
		JobExecutionService,
		JobDeadLetterService,
		TypeOrmJobExecutionRepository,
		MikroOrmJobExecutionRepository,
		TypeOrmJobDeadLetterRepository,
		MikroOrmJobDeadLetterRepository
	],
	exports: [
		JobExecutionService,
		JobDeadLetterService,
		TypeOrmJobExecutionRepository,
		MikroOrmJobExecutionRepository,
		TypeOrmJobDeadLetterRepository,
		MikroOrmJobDeadLetterRepository
	]
})
export class JobExecutionModule {}
