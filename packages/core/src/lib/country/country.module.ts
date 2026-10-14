import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Country } from './country.entity';
import { CountryController } from './country.controller';
import { CountryResolver } from './country.resolver';
import { CountryService } from './country.service';
import { TypeOrmCountryRepository } from './repository/type-orm-country.repository';
import { MikroOrmCountryRepository } from './repository/mikro-orm-country.repository';

/**
 * The platform's country master.
 *
 * `CountryResolver` is declared here beside the service it calls, because a resolver can only inject
 * services its own module can reach and this module is what reaches them. `CountryService` is
 * re-exported for it, not merely provided: a resolver is a provider of whichever module hosts the
 * handler the Apollo configuration names — the GraphQL module, not this one — so a module that
 * imports this one receives the service only if this module hands it on. The REST controller beside
 * the resolver resolves the same service from this module's own providers, which is why nothing
 * needed exporting until the GraphQL view of the same resource existed.
 */
@Module({
	imports: [TypeOrmModule.forFeature([Country]), MikroOrmModule.forFeature([Country])],
	controllers: [CountryController],
	providers: [
		CountryService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		CountryResolver,
		TypeOrmCountryRepository,
		MikroOrmCountryRepository
	],
	exports: [CountryService]
})
export class CountryModule {}