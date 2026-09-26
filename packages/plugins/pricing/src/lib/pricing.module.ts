import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolePermissionModule } from '@gauzy/core';
import { ExchangeRate } from './exchange-rate/exchange-rate.entity';
import { ExchangeRateController } from './exchange-rate/exchange-rate.controller';
import { ExchangeRateService } from './exchange-rate/exchange-rate.service';
import { PriceList } from './price-list/price-list.entity';
import { PriceListController } from './price-list/price-list.controller';
import { PriceListService } from './price-list/price-list.service';
import { PricePreference } from './price-preference/price-preference.entity';
import { PricePreferenceController } from './price-preference/price-preference.controller';
import { PricePreferenceService } from './price-preference/price-preference.service';
import { ProductPrice } from './product-price/product-price.entity';
import { ProductPriceController } from './product-price/product-price.controller';
import { ProductPriceService } from './product-price/product-price.service';
import { RecurringPriceService } from './recurring-price/recurring-price.service';
import { resolvers } from './graphql/resolvers';
import { MikroOrmExchangeRateRepository } from './exchange-rate/repository/mikro-orm-exchange-rate.repository';
import { TypeOrmExchangeRateRepository } from './exchange-rate/repository/type-orm-exchange-rate.repository';
import { MikroOrmPriceListRepository } from './price-list/repository/mikro-orm-price-list.repository';
import { TypeOrmPriceListRepository } from './price-list/repository/type-orm-price-list.repository';
import { MikroOrmPricePreferenceRepository } from './price-preference/repository/mikro-orm-price-preference.repository';
import { TypeOrmPricePreferenceRepository } from './price-preference/repository/type-orm-price-preference.repository';
import { MikroOrmProductPriceRepository } from './product-price/repository/mikro-orm-product-price.repository';
import { TypeOrmProductPriceRepository } from './product-price/repository/type-orm-product-price.repository';

/**
 * The pricing plugin's own module.
 *
 * Both ORM registrations are declared for every table, so the same module boots under either ORM and
 * no service has to know which one is active — except where a cross-ORM read of a legacy core table
 * makes the difference explicit, which the price service states in one place.
 *
 * `RolePermissionModule` is imported because the controllers and resolvers are guarded by the
 * platform's own guards, and a guard is resolved in the injector context of the module that applies
 * it: without this import the guards would have no permission service to ask.
 *
 * The services are exported because the cart, promotion and order capabilities price through them
 * rather than reading these tables themselves — one writer is what keeps a resolved price the same
 * wherever it is asked for.
 */
@Module({
	controllers: [PriceListController, ProductPriceController, PricePreferenceController, ExchangeRateController],
	imports: [
		TypeOrmModule.forFeature([PriceList, ProductPrice, PricePreference, ExchangeRate]),
		MikroOrmModule.forFeature([PriceList, ProductPrice, PricePreference, ExchangeRate]),
		RolePermissionModule
	],
	providers: [
		PriceListService,
		ProductPriceService,
		PricePreferenceService,
		ExchangeRateService,
		RecurringPriceService,
		TypeOrmPriceListRepository,
		MikroOrmPriceListRepository,
		TypeOrmProductPriceRepository,
		MikroOrmProductPriceRepository,
		TypeOrmPricePreferenceRepository,
		MikroOrmPricePreferenceRepository,
		TypeOrmExchangeRateRepository,
		MikroOrmExchangeRateRepository,
		...resolvers
	],
	exports: [PriceListService, ProductPriceService, PricePreferenceService, ExchangeRateService, RecurringPriceService]
})
export class PricingModule {}
