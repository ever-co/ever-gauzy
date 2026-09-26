import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { IdempotencyKey } from './idempotency-key.entity';
import { IdempotencyService } from './idempotency.service';
import { IDEMPOTENCY_SERVICE } from './idempotency-constant';
import { TypeOrmIdempotencyKeyRepository } from './repository/type-orm-idempotency-key.repository';
import { MikroOrmIdempotencyKeyRepository } from './repository/mikro-orm-idempotency-key.repository';
import { IdempotencyKeyController } from './idempotency-key.controller';
import { IdempotencyKeyResolver } from './idempotency-key.resolver';

/**
 * Stored retry keys: the row, the service over it and the operator's surface.
 *
 * **The schedule is not declared here**, and it was moved out for a reason worth keeping. A job
 * provider is instantiated inside the module that registers it, not inside the module that owns the
 * service it injects: `SchedulerModule.forFeature` puts the provider in its own injector, so a worker
 * declared here would have to be handed this module as an import of *that* one — a cycle between two
 * modules that exist for each other. `IdempotencyMaintenanceModule` owns the sweep instead and imports
 * this module for the service, which is the ordinary direction and the reason the application imports
 * both.
 *
 * **The controller and the resolver are declared here, beside the service they call.** A resolver is an
 * ordinary Nest provider and can only inject what the module hosting it can reach, so declaring it
 * anywhere else would either duplicate the service or leave the field answering null on every call with
 * nothing red anywhere.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([IdempotencyKey]),
		MikroOrmModule.forFeature([IdempotencyKey]),
		// Imported for the guards rather than for a resolver: `TenantPermissionGuard` resolves the role
		// permissions of the caller, so the module that mounts it has to reach that service. Every
		// controller-bearing module on the platform imports this one for the same reason.
		RolePermissionModule
	],
	controllers: [IdempotencyKeyController],
	providers: [
		IdempotencyService,
		// The same instance under a token that carries no module graph, so a consumer that only needs
		// to ask the store a question — the concurrency guard — can reach it without importing the
		// service class and everything the service class imports. `useExisting`, so there is one store.
		{ provide: IDEMPOTENCY_SERVICE, useExisting: IdempotencyService },
		TypeOrmIdempotencyKeyRepository,
		MikroOrmIdempotencyKeyRepository,
		// The GraphQL view of the same resource.
		IdempotencyKeyResolver
	],
	exports: [
		IdempotencyService,
		IDEMPOTENCY_SERVICE,
		TypeOrmIdempotencyKeyRepository,
		MikroOrmIdempotencyKeyRepository
	]
})
export class IdempotencyModule {}
