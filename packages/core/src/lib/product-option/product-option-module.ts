import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ProductOption } from './product-option.entity';
import { ProductOptionService } from './product-option.service';
import { ProductOptionController } from './product-option.controller';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { ProductOptionGroupService } from './product-option-group.service';
import { ProductOptionTranslation } from './product-option-translation.entity';
import { ProductOptionGroup } from './product-option-group.entity';
import { ProductOptionGroupTranslation } from './product-option-group-translation.entity';
import { ProductOptionResolver } from './product-option.resolver';
import { TypeOrmProductOptionRepository } from './repository/type-orm-product-option.repository';
import { TypeOrmProductOptionTranslationRepository } from './repository/type-orm-product-option-translation.repository';
import { TypeOrmProductOptionGroupRepository } from './repository/type-orm-product-option-group.repository';
import { TypeOrmProductOptionGroupTranslationRepository } from './repository/type-orm-product-option-group-translation.repository';

/**
 * The values a product is offered in.
 *
 * `ProductOptionResolver` is declared here beside the service it calls, because a resolver can only
 * inject services its own module can reach and this module is what reaches them. Nothing had to be
 * re-exported for it: the resolver's one dependency is `ProductOptionService`, and this module already
 * exports it — the REST controller beside the resolver resolves the same service from this module's
 * own providers. The guard the resolver carries is a provider of the module that hosts it, which is
 * the GraphQL module rather than this one, for the same reason.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([
			ProductOption,
			ProductOptionTranslation,
			ProductOptionGroup,
			ProductOptionGroupTranslation
		]),
		MikroOrmModule.forFeature([
			ProductOption,
			ProductOptionTranslation,
			ProductOptionGroup,
			ProductOptionGroupTranslation
		]),
		RolePermissionModule
	],
	controllers: [ProductOptionController],
	providers: [
		ProductOptionService,
		ProductOptionGroupService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		ProductOptionResolver,
		TypeOrmProductOptionRepository,
		TypeOrmProductOptionTranslationRepository,
		TypeOrmProductOptionGroupRepository,
		TypeOrmProductOptionGroupTranslationRepository
	],
	exports: [ProductOptionService, ProductOptionGroupService]
})
export class ProductOptionModule {}
