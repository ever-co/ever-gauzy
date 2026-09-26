import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ProductType } from './product-type.entity';
import { ProductTypeController } from './product-type.controller';
import { ProductTypeService } from './product-type.service';
import { ProductTypeResolver } from './product-type.resolver';
import { ProductTypeTranslation } from './product-type-translation.entity';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmProductTypeRepository } from './repository/type-orm-product-type.repository';
import { MikroOrmProductTypeRepository } from './repository/mikro-orm-product-type.repository';

/**
 * The operator-facing product classification.
 *
 * The service and the command bus are exported, and neither was before the GraphQL view of the same
 * resource existed. A resolver is a provider of whichever module hosts the handler the Apollo
 * configuration names, so a module that imports this one receives `ProductTypeService` and the bus —
 * which the resolver injects — only if this module hands them on. The REST controller beside it
 * resolves both from this module's own providers and imports, which is why nothing needed exporting
 * until now.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([ProductType, ProductTypeTranslation]),
		MikroOrmModule.forFeature([ProductType, ProductTypeTranslation]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [ProductTypeController],
	providers: [
		ProductTypeService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		ProductTypeResolver,
		TypeOrmProductTypeRepository,
		MikroOrmProductTypeRepository,
		...CommandHandlers
	],
	exports: [ProductTypeService, CqrsModule]
})
export class ProductTypeModule {}