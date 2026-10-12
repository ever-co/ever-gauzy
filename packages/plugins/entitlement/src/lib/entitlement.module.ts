import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
	EventBusModule,
	EventOutboxModule,
	FeatureModule,
	RolePermissionModule,
	RuleModule,
	SequenceModule
} from '@gauzy/core';
import { resolvers } from './graphql/resolvers';
import { EntitlementGrantConsumer } from './events/entitlement-grant.consumer';
import { Entitlement } from './entitlement/entitlement.entity';
import { EntitlementController } from './entitlement/entitlement.controller';
import { EntitlementService } from './entitlement/entitlement.service';
import { MikroOrmEntitlementRepository } from './entitlement/repository/mikro-orm-entitlement.repository';
import { TypeOrmEntitlementRepository } from './entitlement/repository/type-orm-entitlement.repository';
import { EntitlementActivation } from './entitlement-activation/entitlement-activation.entity';
import { EntitlementActivationController } from './entitlement-activation/entitlement-activation.controller';
import { EntitlementActivationService } from './entitlement-activation/entitlement-activation.service';
import { MikroOrmEntitlementActivationRepository } from './entitlement-activation/repository/mikro-orm-entitlement-activation.repository';
import { TypeOrmEntitlementActivationRepository } from './entitlement-activation/repository/type-orm-entitlement-activation.repository';
import { EntitlementKey } from './entitlement-key/entitlement-key.entity';
import { EntitlementKeyController } from './entitlement-key/entitlement-key.controller';
import { EntitlementKeyService } from './entitlement-key/entitlement-key.service';
import { MikroOrmEntitlementKeyRepository } from './entitlement-key/repository/mikro-orm-entitlement-key.repository';
import { TypeOrmEntitlementKeyRepository } from './entitlement-key/repository/type-orm-entitlement-key.repository';
import { EntitlementCheckService } from './entitlement-check/entitlement-check.service';
import { EntitlementRequiredGuard } from './entitlement-check/entitlement-check.guard';

/** Every entity this plugin owns, in dependency order, as one array. */
export const ALL_ENTITLEMENT_ENTITIES = [Entitlement, EntitlementKey, EntitlementActivation];

/**
 * The entitlement domain's Nest wiring.
 *
 * Both ORMs are registered for every entity because the platform selects its ORM at boot, and the
 * paired repositories are providers rather than being constructed by the services — that pairing is
 * what lets the same service run on either.
 *
 * Four kernel capabilities are imported rather than re-implemented: the feature service the flag
 * guard reads, the role-permission service the permission guard reads, the numbering series a right
 * is numbered from, the rule engine its conditions are stored in, and the outbox every state change
 * writes its event to. A guard is a provider of the module that declares the handler it protects, so
 * `FeatureModule` and `RolePermissionModule` are imported here rather than by a parent — Nest imports
 * are not inherited downwards.
 */
@Module({
	controllers: [EntitlementController, EntitlementActivationController, EntitlementKeyController],
	imports: [
		TypeOrmModule.forFeature(ALL_ENTITLEMENT_ENTITIES),
		MikroOrmModule.forFeature(ALL_ENTITLEMENT_ENTITIES),
		// Every controller carries `@UseGuards(..., FeatureFlagGuard)`, so this module is what has to
		// import the feature service the guard reads.
		FeatureModule,
		RolePermissionModule,
		SequenceModule,
		RuleModule,
		EventBusModule,
		EventOutboxModule
	],
	providers: [
		EntitlementService,
		EntitlementActivationService,
		EntitlementKeyService,
		EntitlementCheckService,
		EntitlementRequiredGuard,
		TypeOrmEntitlementRepository,
		MikroOrmEntitlementRepository,
		TypeOrmEntitlementKeyRepository,
		MikroOrmEntitlementKeyRepository,
		TypeOrmEntitlementActivationRepository,
		MikroOrmEntitlementActivationRepository,
		// The grant path registers itself with the platform's consumer registry on bootstrap, so an
		// order or subscription event is what grants a right without this package reading another
		// package's tables.
		EntitlementGrantConsumer,
		// The GraphQL resolvers are providers here because they inject the same services the REST
		// controllers do; the plugin hands the composition pass the same classes through
		// `extensions.resolvers`, so there is one implementation per rule rather than one per surface.
		...resolvers
	],
	exports: [
		EntitlementService,
		EntitlementActivationService,
		EntitlementKeyService,
		EntitlementCheckService,
		EntitlementRequiredGuard,
		TypeOrmEntitlementRepository,
		MikroOrmEntitlementRepository,
		TypeOrmEntitlementKeyRepository,
		MikroOrmEntitlementKeyRepository,
		TypeOrmEntitlementActivationRepository,
		MikroOrmEntitlementActivationRepository
	]
})
export class EntitlementModule {}
