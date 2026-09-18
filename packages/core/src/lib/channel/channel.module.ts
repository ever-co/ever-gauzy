import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CurrencyModule } from '../currency/currency.module';
import { Channel } from './channel.entity';
import { ChannelService } from './channel.service';
import { TypeOrmChannelRepository } from './repository/type-orm-channel.repository';
import { MikroOrmChannelRepository } from './repository/mikro-orm-channel.repository';
import { ChannelDomain } from '../channel-domain/channel-domain.entity';
import { ChannelDomainService } from '../channel-domain/channel-domain.service';
import { TypeOrmChannelDomainRepository } from '../channel-domain/repository/type-orm-channel-domain.repository';
import { MikroOrmChannelDomainRepository } from '../channel-domain/repository/mikro-orm-channel-domain.repository';
import { Region } from '../region/region.entity';
import { RegionService } from '../region/region.service';
import { TypeOrmRegionRepository } from '../region/repository/type-orm-region.repository';
import { MikroOrmRegionRepository } from '../region/repository/mikro-orm-region.repository';
import { RegionCountry } from '../region-country/region-country.entity';
import { RegionCountryService } from '../region-country/region-country.service';
import { TypeOrmRegionCountryRepository } from '../region-country/repository/type-orm-region-country.repository';
import { MikroOrmRegionCountryRepository } from '../region-country/repository/mikro-orm-region-country.repository';
import { ChannelRegion } from '../channel-region/channel-region.entity';
import { ChannelRegionService } from '../channel-region/channel-region.service';
import { TypeOrmChannelRegionRepository } from '../channel-region/repository/type-orm-channel-region.repository';
import { MikroOrmChannelRegionRepository } from '../channel-region/repository/mikro-orm-channel-region.repository';

/**
 * The sales context: the channel, the hostnames that resolve to it, the commercial geography, and the
 * two pivots that bind them.
 *
 * **Named after the channel because the channel is the root of the domain.** Every resolution the
 * platform makes for a request — which region, which currency, which publication, which price, which
 * stock — is made *for a channel*, so the channel is the aggregate the other four tables hang off: its
 * hostnames are what a request resolves to it by, its region set is what it may sell into, and a
 * region's countries are what that set serves. One module provides all five services, because a caller
 * that can name a channel but not the geography it sells into cannot price anything.
 *
 * **Both ORMs are registered**, because the kernel is dual-ORM: the entity decorators map the five
 * tables for whichever mapper the deployment runs, and each repository pair is provided here so a
 * service injected with one is resolved from the module that declares its table rather than from
 * whichever module happens to import this one first.
 *
 * **The repository classes are exported as well as the services.** A consumer that answers a question
 * these services do not — a storefront resolving a host before the request context exists, a
 * reconciliation walking every channel's region set — needs the same repository the services write
 * through, and re-providing it elsewhere would give it a second instance over the same table.
 *
 * **`CurrencyModule` is imported for a service, not for a guard.** The region's write path checks its
 * currency against the platform's currency master (invariant I-26), and the master is the module that
 * owns that question; asking it here rather than re-reading the table is what keeps "which currencies
 * exist" a single answer. **`RolePermissionModule` is imported for the guards**: this module owns no HTTP
 * handler today, but a guard is a provider of whichever module hosts the handler it protects, so the
 * module that will host this domain's controllers and resolvers has to be able to reach the permission
 * lookup those guards ask for.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([Channel, ChannelDomain, Region, RegionCountry, ChannelRegion]),
		MikroOrmModule.forFeature([Channel, ChannelDomain, Region, RegionCountry, ChannelRegion]),
		CurrencyModule,
		RolePermissionModule
	],
	providers: [
		ChannelService,
		ChannelDomainService,
		RegionService,
		RegionCountryService,
		ChannelRegionService,
		TypeOrmChannelRepository,
		MikroOrmChannelRepository,
		TypeOrmChannelDomainRepository,
		MikroOrmChannelDomainRepository,
		TypeOrmRegionRepository,
		MikroOrmRegionRepository,
		TypeOrmRegionCountryRepository,
		MikroOrmRegionCountryRepository,
		TypeOrmChannelRegionRepository,
		MikroOrmChannelRegionRepository
	],
	exports: [
		ChannelService,
		ChannelDomainService,
		RegionService,
		RegionCountryService,
		ChannelRegionService,
		TypeOrmChannelRepository,
		MikroOrmChannelRepository,
		TypeOrmChannelDomainRepository,
		MikroOrmChannelDomainRepository,
		TypeOrmRegionRepository,
		MikroOrmRegionRepository,
		TypeOrmRegionCountryRepository,
		MikroOrmRegionCountryRepository,
		TypeOrmChannelRegionRepository,
		MikroOrmChannelRegionRepository
	]
})
export class ChannelModule {}
