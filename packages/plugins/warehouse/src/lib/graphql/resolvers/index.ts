import { CarrierManifestResolver } from './carrier-manifest.resolver';
import { PackSlipResolver } from './pack-slip.resolver';
import { PickListLineResolver } from './pick-list-line.resolver';
import { PickListResolver } from './pick-list.resolver';
import { PickWaveResolver } from './pick-wave.resolver';
import { WarehouseBinResolver } from './warehouse-bin.resolver';
import { WarehouseZoneResolver } from './warehouse-zone.resolver';

/**
 * Every resolver this plugin contributes to the platform schema.
 *
 * The list is what the plugin hands the composition pass, and each class is also a provider of the
 * plugin's module — a resolver injects the same services the REST controllers do, so both surfaces run
 * through one implementation of every rule.
 */
export const resolvers = [
	WarehouseZoneResolver,
	WarehouseBinResolver,
	PickWaveResolver,
	PickListResolver,
	PickListLineResolver,
	PackSlipResolver,
	CarrierManifestResolver
];

export {
	WarehouseZoneResolver,
	WarehouseBinResolver,
	PickWaveResolver,
	PickListResolver,
	PickListLineResolver,
	PackSlipResolver,
	CarrierManifestResolver
};
