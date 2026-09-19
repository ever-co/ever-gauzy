import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Merchant } from './merchant.entity';
import { MerchantController } from './merchant.controller';
import { MerchantResolver } from './merchant.resolver';
import { MerchantService } from './merchant.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmMerchantRepository } from './repository/type-orm-merchant.repository';
import { MikroOrmMerchantRepository } from './repository/mikro-orm-merchant.repository';

/**
 * The store.
 *
 * The resolver is declared here, beside the service it calls: a resolver is an ordinary Nest provider
 * and can only inject what the module hosting it can reach. It adds one provider and no second
 * dependency.
 *
 * **The repository pair is registered here, and it was missing.** `MerchantService` extends the platform's
 * tenant-aware CRUD service, whose constructor is handed the two repositories this deployment's mappers
 * need; the module declared the service without them, so the base held `undefined` where its store should
 * have been and every read answered `Cannot read properties of undefined (reading 'metadata')`. Both
 * protocols answered that — the REST route and the GraphQL field beside it — because both call the one
 * service. The pair is provided here rather than injected ad hoc so the service is built over the same two
 * repositories every other domain's service is.
 */
@Module({
	imports: [TypeOrmModule.forFeature([Merchant]), MikroOrmModule.forFeature([Merchant]), RolePermissionModule],
	controllers: [MerchantController],
	providers: [
		MerchantService,
		TypeOrmMerchantRepository,
		MikroOrmMerchantRepository,
		// The GraphQL view of the same resource.
		MerchantResolver
	],
	exports: [MerchantService]
})
export class MerchantModule {}
