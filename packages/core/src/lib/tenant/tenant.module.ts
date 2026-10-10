import { forwardRef, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { AuthModule } from '../auth/auth.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { RoleModule } from '../role/role.module';
import { StripeSubscriptionService } from '../shared/billing/stripe-subscription.service';
import { UserModule } from '../user/user.module';
import { FeatureModule } from './../feature/feature.module';
import { TenantController } from './tenant.controller';
import { TenantResolver } from './tenant.resolver';
import { Tenant } from './tenant.entity';
import { TenantService } from './tenant.service';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmTenantRepository } from './repository/type-orm-tenant.repository';
import { MikroOrmTenantRepository } from './repository/mikro-orm-tenant.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([Tenant]),
		MikroOrmModule.forFeature([Tenant]),
		AuthModule,
		CqrsModule,
		forwardRef(() => UserModule),
		forwardRef(() => RoleModule),
		forwardRef(() => RolePermissionModule),
		// Imported for the gate rather than for a resolver: the GraphQL surface is guarded by
		// `FeatureFlagGuard`, and a guard is a provider of whichever module declares the handler it
		// protects — so this module is what has to reach the feature service the guard resolves
		// through. Without it the API boot fails on an unresolved dependency, which no static check
		// sees.
		forwardRef(() => FeatureModule)
	],
	controllers: [TenantController],
	providers: [
		TenantService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		TenantResolver,
		TypeOrmTenantRepository,
		MikroOrmTenantRepository,
		// Lets onboardTenant() record the tenant -> Stripe customer link. Inert without a Stripe key.
		StripeSubscriptionService,
		...CommandHandlers
	],
	exports: [TenantService, TypeOrmTenantRepository, MikroOrmTenantRepository]
})
export class TenantModule {}