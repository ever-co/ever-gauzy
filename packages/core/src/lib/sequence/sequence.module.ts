import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { Sequence } from './sequence.entity';
import { SequenceController } from './sequence.controller';
import { SequenceResolver } from './sequence.resolver';
import { SequenceService } from './sequence.service';
import { TypeOrmSequenceRepository } from './repository/type-orm-sequence.repository';
import { MikroOrmSequenceRepository } from './repository/mikro-orm-sequence.repository';

/**
 * The numbering kernel: the counters every domain's document numbers are allocated from.
 *
 * The module provides the service, both repositories, the REST controller and the GraphQL resolver of
 * the same resource, because the three surfaces — allocation, `/api/sequences` and the `sequences`
 * root fields — are one capability stated three ways and each one calls this one service.
 *
 * **`RolePermissionModule` is imported for the guards, not for a service.** `TenantPermissionGuard` and
 * `PermissionGuard` are the chain the controller and the resolver both carry, and a guard is a provider
 * of whichever module hosts the handler it protects — so the module that hosts them has to be able to
 * reach the permission lookup those guards ask for, or the API boot fails on an unresolved dependency.
 *
 * **`IdempotencyModule` is imported for the allocation.** A number may be claimed under a caller's
 * idempotency key, and the allocation reaches that key's store through the kernel's own service: Nest
 * imports are not inherited downwards, so the row this module writes is only reachable from the module
 * that imports the service owning it.
 *
 * `FeatureModule` is deliberately not imported, although the resolver's chain carries the feature gate:
 * the module is global, so the feature service `FeatureFlagGuard` resolves through is available
 * wherever a guard runs, and an import here would be one edge in every module that declares a resolver.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([Sequence]),
		MikroOrmModule.forFeature([Sequence]),
		IdempotencyModule,
		RolePermissionModule
	],
	controllers: [SequenceController],
	providers: [
		SequenceService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		SequenceResolver,
		TypeOrmSequenceRepository,
		MikroOrmSequenceRepository
	],
	exports: [SequenceService, SequenceResolver, TypeOrmSequenceRepository, MikroOrmSequenceRepository]
})
export class SequenceModule {}
