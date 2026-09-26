import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureModule, RolePermissionModule, SequenceModule, Warehouse } from '@gauzy/core';
import { CarrierManifestController } from './carrier-manifest/carrier-manifest.controller';
import { CarrierManifest } from './carrier-manifest/carrier-manifest.entity';
import { CarrierManifestService } from './carrier-manifest/carrier-manifest.service';
import { MikroOrmCarrierManifestRepository } from './carrier-manifest/repository/mikro-orm-carrier-manifest.repository';
import { TypeOrmCarrierManifestRepository } from './carrier-manifest/repository/type-orm-carrier-manifest.repository';
import { resolvers } from './graphql/resolvers';
import { PackSlipController } from './pack-slip/pack-slip.controller';
import { PackSlip } from './pack-slip/pack-slip.entity';
import { PackSlipService } from './pack-slip/pack-slip.service';
import { MikroOrmPackSlipRepository } from './pack-slip/repository/mikro-orm-pack-slip.repository';
import { TypeOrmPackSlipRepository } from './pack-slip/repository/type-orm-pack-slip.repository';
import { PickListController } from './pick-list/pick-list.controller';
import { PickList } from './pick-list/pick-list.entity';
import { PickListService } from './pick-list/pick-list.service';
import { MikroOrmPickListRepository } from './pick-list/repository/mikro-orm-pick-list.repository';
import { TypeOrmPickListRepository } from './pick-list/repository/type-orm-pick-list.repository';
import { PickListLineController } from './pick-list-line/pick-list-line.controller';
import { PickListLine } from './pick-list-line/pick-list-line.entity';
import { PickListLineService } from './pick-list-line/pick-list-line.service';
import { MikroOrmPickListLineRepository } from './pick-list-line/repository/mikro-orm-pick-list-line.repository';
import { TypeOrmPickListLineRepository } from './pick-list-line/repository/type-orm-pick-list-line.repository';
import { PickWaveController } from './pick-wave/pick-wave.controller';
import { PickWave } from './pick-wave/pick-wave.entity';
import { PickWaveService } from './pick-wave/pick-wave.service';
import { MikroOrmPickWaveRepository } from './pick-wave/repository/mikro-orm-pick-wave.repository';
import { TypeOrmPickWaveRepository } from './pick-wave/repository/type-orm-pick-wave.repository';
import { WarehouseBinController } from './warehouse-bin/warehouse-bin.controller';
import { WarehouseBin } from './warehouse-bin/warehouse-bin.entity';
import { WarehouseBinService } from './warehouse-bin/warehouse-bin.service';
import { MikroOrmWarehouseBinRepository } from './warehouse-bin/repository/mikro-orm-warehouse-bin.repository';
import { TypeOrmWarehouseBinRepository } from './warehouse-bin/repository/type-orm-warehouse-bin.repository';
import { WarehouseZoneController } from './warehouse-zone/warehouse-zone.controller';
import { WarehouseZone } from './warehouse-zone/warehouse-zone.entity';
import { WarehouseZoneService } from './warehouse-zone/warehouse-zone.service';
import { MikroOrmWarehouseZoneRepository } from './warehouse-zone/repository/mikro-orm-warehouse-zone.repository';
import { TypeOrmWarehouseZoneRepository } from './warehouse-zone/repository/type-orm-warehouse-zone.repository';

/**
 * Every entity this plugin owns, in dependency order, as one array.
 *
 * `warehouse_bin_closure` is deliberately absent: it is the ORM's closure table for the bin tree,
 * created by this plugin's migration and maintained by the ORM and the bin service, and it is never
 * mapped as an entity.
 */
export const ALL_WAREHOUSE_ENTITIES = [
	WarehouseZone,
	WarehouseBin,
	PickWave,
	PickList,
	PickListLine,
	PackSlip,
	CarrierManifest
];

/**
 * The warehouse domain's Nest wiring.
 *
 * Both ORMs are registered for every entity because the platform selects its ORM at boot, and the
 * paired repositories are providers rather than being constructed by the services — that pairing is
 * what lets the same service run on either.
 *
 * Two capabilities are reached through optional injection tokens rather than imported modules: the
 * stock ledger and the shipment records both belong to other domains. Registering a provider under one
 * of those tokens is what enables the corresponding behaviour, and the services refuse an operation
 * they cannot complete correctly rather than guessing when a capability they need is absent.
 */
@Module({
	controllers: [
		WarehouseZoneController,
		WarehouseBinController,
		PickWaveController,
		PickListController,
		PickListLineController,
		PackSlipController,
		CarrierManifestController
	],
	imports: [
		TypeOrmModule.forFeature(ALL_WAREHOUSE_ENTITIES),
		// The location row is the kernel's, and the only thing this plugin reads from it is its
		// `metadata` — the settings a count obeys. It is registered so the bin service can inject the
		// repository; it is deliberately absent from `ALL_WAREHOUSE_ENTITIES`, which is the list of
		// tables this plugin owns and migrates.
		TypeOrmModule.forFeature([Warehouse]),
		MikroOrmModule.forFeature(ALL_WAREHOUSE_ENTITIES),
		// Every controller here is `@UseGuards(..., FeatureFlagGuard)`: the guard is a provider of this
		// module, so this module is what has to import the feature service it reads.
		FeatureModule,
		RolePermissionModule,
		SequenceModule
	],
	providers: [
		WarehouseZoneService,
		WarehouseBinService,
		PickWaveService,
		PickListService,
		PickListLineService,
		PackSlipService,
		CarrierManifestService,
		TypeOrmWarehouseZoneRepository,
		MikroOrmWarehouseZoneRepository,
		TypeOrmWarehouseBinRepository,
		MikroOrmWarehouseBinRepository,
		TypeOrmPickWaveRepository,
		MikroOrmPickWaveRepository,
		TypeOrmPickListRepository,
		MikroOrmPickListRepository,
		TypeOrmPickListLineRepository,
		MikroOrmPickListLineRepository,
		TypeOrmPackSlipRepository,
		MikroOrmPackSlipRepository,
		TypeOrmCarrierManifestRepository,
		MikroOrmCarrierManifestRepository,
		// The GraphQL resolvers are providers here because they inject the same services the REST
		// controllers do; the plugin hands the composition pass the same classes through
		// `extensions.resolvers`, so there is one implementation per rule rather than one per surface.
		...resolvers
	],
	exports: [
		WarehouseZoneService,
		WarehouseBinService,
		PickWaveService,
		PickListService,
		PickListLineService,
		PackSlipService,
		CarrierManifestService
	]
})
export class WarehouseModule {}
