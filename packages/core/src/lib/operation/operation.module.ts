import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { GraphqlSubscriptionModule } from '../graphql/subscriptions';
import { Operation } from './operation.entity';
import { OperationStep } from './operation-step.entity';
import { OperationRegistry } from './operation.registry';
import { OperationService } from './operation.service';
import { OperationController } from './operation.controller';
import { OperationResolver, OperationStepResolver } from './operation.resolver';
import { OperationEventPublisher } from './operation-event.publisher';
import { TypeOrmOperationRepository } from './repository/type-orm-operation.repository';
import { TypeOrmOperationStepRepository } from './repository/type-orm-operation-step.repository';
import { MikroOrmOperationRepository } from './repository/mikro-orm-operation.repository';
import { MikroOrmOperationStepRepository } from './repository/mikro-orm-operation-step.repository';

/**
 * The durable-operation runtime and its management surface.
 *
 * **The controller and the resolvers are declared here, beside the service they call**, because a
 * resolver or a controller can only inject what its own module can reach and this module is what
 * reaches the runtime. The GraphQL host discovers the two resolvers by scanning this module rather
 * than by listing the classes, which is why their being providers here is the whole of the
 * registration.
 *
 * **`RolePermissionModule` is imported for the guards**, not for a resolver: a guard is a provider of
 * whichever module hosts the handler it protects, so the module that hosts this resource's routes and
 * fields has to be able to reach the permission lookup `PermissionGuard` and `TenantPermissionGuard`
 * ask for. `FeatureModule` is deliberately not imported although both resolvers carry the feature
 * gate: the module is global, so the feature service `FeatureFlagGuard` resolves through is available
 * wherever a guard runs.
 *
 * **`GraphqlSubscriptionModule` is imported for the publisher**, not for a resolver. The three facts
 * this domain streams travel on the platform's own fan-out, so the module that owns the writers — the
 * service — has to reach `GraphqlPubSub` and the event catalogue. Importing it here rather than in the
 * composition module alone is what lets the publisher resolve its dependencies from the module that
 * declares it, and Nest's modules are singletons, so the composition module reaches the same instance.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([Operation, OperationStep]),
		MikroOrmModule.forFeature([Operation, OperationStep]),
		RolePermissionModule,
		GraphqlSubscriptionModule
	],
	controllers: [OperationController],
	providers: [
		OperationService,
		OperationRegistry,
		OperationEventPublisher,
		// The GraphQL view of the same resource: two classes, because the kernel declares two types and
		// each is resolved from this resource's rows.
		OperationResolver,
		OperationStepResolver,
		TypeOrmOperationRepository,
		TypeOrmOperationStepRepository,
		MikroOrmOperationRepository,
		MikroOrmOperationStepRepository
	],
	exports: [
		OperationService,
		OperationRegistry,
		OperationEventPublisher,
		OperationResolver,
		OperationStepResolver,
		TypeOrmOperationRepository,
		TypeOrmOperationStepRepository,
		MikroOrmOperationRepository,
		MikroOrmOperationStepRepository
	]
})
export class OperationModule {}
