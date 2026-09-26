import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ProductVariantSetting } from './product-setting.entity';
import { ProductVariantSettingService } from './product-setting.service';
import { ProductVariantSettingController } from './product-setting.controller';
import { ProductVariantSettingResolver } from './product-setting.resolver';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmProductVariantSettingRepository } from './repository/type-orm-product-setting.repository';
import { MikroOrmProductVariantSettingRepository } from './repository/mikro-orm-product-setting.repository';

/**
 * The capability record of a variant.
 *
 * `ProductVariantSettingResolver` is declared beside the controller, because a resolver is a provider
 * of whichever module hosts the handler the Apollo configuration names, and a provider can only
 * inject what its own module can reach.
 *
 * **Nothing here is re-exported for the resolver's sake.** Its one dependency is
 * `ProductVariantSettingService`, which this module already exports; the guard it carries with the
 * controller resolves from `RolePermissionModule`, which is already imported for the controller's
 * own guard. A resource whose routes are all the base controller's therefore needs no export added
 * when its GraphQL view lands — unlike a resource whose resolver reads a second domain's service or
 * dispatches a command.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([ProductVariantSetting]),
		MikroOrmModule.forFeature([ProductVariantSetting]),
		RolePermissionModule
	],
	controllers: [ProductVariantSettingController],
	providers: [
		ProductVariantSettingService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		ProductVariantSettingResolver,
		TypeOrmProductVariantSettingRepository,
		MikroOrmProductVariantSettingRepository
	],
	exports: [ProductVariantSettingService]
})
export class ProductVariantSettingModule {}