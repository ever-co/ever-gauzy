import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ProductCategory } from './product-category.entity';
import { ProductCategoryService } from './product-category.service';
import { ProductCategoryController } from './product-category.controller';
import { ProductCategoryResolver } from './product-category.resolver';
import { ProductCategoryTranslation } from './product-category-translation.entity';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmProductCategoryRepository } from './repository/type-orm-product-category.repository';
import { MikroOrmProductCategoryRepository } from './repository/mikro-orm-product-category.repository';

/**
 * The product taxonomy.
 *
 * `CqrsModule` is re-exported, not merely imported, and that is what makes the resolver's non-service
 * dependency resolvable: a resolver is a provider of whichever module hosts the handler the Apollo
 * configuration names, so a module that imports this one receives the command bus only if this module
 * hands it on. The REST controller beside it resolves the bus from this module's own imports, which is
 * why nothing needed re-exporting until the GraphQL view of the same resource existed.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([ProductCategory, ProductCategoryTranslation]),
		MikroOrmModule.forFeature([ProductCategory, ProductCategoryTranslation]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [ProductCategoryController],
	providers: [
		ProductCategoryService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		ProductCategoryResolver,
		TypeOrmProductCategoryRepository,
		MikroOrmProductCategoryRepository,
		...CommandHandlers
	],
	exports: [ProductCategoryService, CqrsModule]
})
export class ProductCategoryModule {}