import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Currency } from './currency.entity';
import { CurrencyController } from './currency.controller';
import { CurrencyResolver } from './currency.resolver';
import { CurrencyService } from './currency.service';
import { TypeOrmCurrencyRepository } from './repository/type-orm-currency.repository';
import { MikroOrmCurrencyRepository } from './repository/mikro-orm-currency.repository';

/**
 * The platform's currency master.
 *
 * `CurrencyResolver` is declared here beside the service it calls, because a resolver can only inject
 * services its own module can reach and this module is what reaches them. Nothing had to be
 * re-exported for it: the resolver's one dependency is `CurrencyService`, and this module already
 * exports it — the REST controller beside the resolver resolves the same service from this module's
 * own providers, and the module that hosts the resolver receives it through the same export.
 */
@Module({
	imports: [TypeOrmModule.forFeature([Currency]), MikroOrmModule.forFeature([Currency])],
	controllers: [CurrencyController],
	providers: [
		CurrencyService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		CurrencyResolver,
		TypeOrmCurrencyRepository,
		MikroOrmCurrencyRepository
	],
	exports: [CurrencyService]
})
export class CurrencyModule {}