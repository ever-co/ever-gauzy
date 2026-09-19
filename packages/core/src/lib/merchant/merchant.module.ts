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
 * **The repository pair is registered here, and the service declares `@Injectable()`.** Both halves are
 * needed and neither alone is enough: the module says *which* two repositories the service is built
 * over, and the decorator is what makes the container pass them. A class with no decorator carries no
 * `design:paramtypes`, so Nest calls its constructor with nothing and the inherited store stays
 * `undefined` — which is what the merchant resource answered for as long as it did, on both protocols,
 * because a REST route and a GraphQL field that call one service fail together. The two mappers are
 * provided here rather than injected ad hoc so the service is built over the same pair every other
 * domain's service is.
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
