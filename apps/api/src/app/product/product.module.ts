import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { Product } from './product.entity';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { ProductOption } from '../product-option/product-option.entity';
import { CqrsModule } from '@nestjs/cqrs';
import { ProductOptionService } from '../product-option/product-option.service';
import { ProductCreateHandler } from './commands/handlers/product.create.handler';
import { ProductUpdateHandler } from './commands/handlers/product.update.handler';
import { UserService } from '../user/user.service';
import { User } from '../user/user.entity';
import { ProductDeleteHandler } from './commands/handlers/product.delete.handler';
import { ProductVariantService } from '../product-variant/product-variant.service';
import { ProductVariant } from '../product-variant/product-variant.entity';
import { ProductVariantSettings } from '../product-settings/product-settings.entity';
import { ProductVariantSettingService } from '../product-settings/product-settings.service';
import { ProductVariantPriceService } from '../product-variant-price/product-variant-price.service';
import { ProductVariantPrice } from '../product-variant-price/product-variant-price.entity';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			Product,
			ProductOption,
			User,
			ProductVariant,
			ProductVariantSettings,
			ProductVariantPrice
		]),
		CqrsModule
	],
	controllers: [ProductController],
	providers: [
		ProductService,
		ProductOptionService,
		ProductVariantService,
		ProductVariantSettingService,
		ProductVariantPriceService,
		ProductCreateHandler,
		ProductUpdateHandler,
		UserService,
		ProductDeleteHandler
	],
	exports: [ProductService]
})
export class ProductModule {}
