import * as chalk from 'chalk';
import { Type } from '@nestjs/common';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { IUnitReference, registerUnitReferences, UnitCategoryCode } from '@gauzy/core';
import { CreateWarehouseLayoutTables1791000000180 } from './database/migrations/1791000000180-CreateWarehouseLayoutTables';
import { CreateWarehouseWorkTables1791000000190 } from './database/migrations/1791000000190-CreateWarehouseWorkTables';
import { AddWarehouseBinCapacityUnits1791000000195 } from './database/migrations/1791000000195-AddWarehouseBinCapacityUnits';
import { AddWarehouseBinCapacityUnitForeignKeys1791000000196 } from './database/migrations/1791000000196-AddWarehouseBinCapacityUnitForeignKeys';
import { resolvers } from './graphql/resolvers';
import { schemaExtensions } from './graphql/schema-extensions';
import { WAREHOUSE_FEATURES } from './warehouse.features';
import { WarehouseModule, ALL_WAREHOUSE_ENTITIES } from './warehouse.module';
import { WAREHOUSE_PERMISSIONS } from './warehouse.permissions';

/**
 * The plugin packages that must be loaded before this one.
 *
 * A bin is a position inside a stock location, and what sits in it is a level row the inventory
 * capability owns: derivation reads the home bin of a level through that capability's port and writes
 * every physical move back through it, so the capability has to be present for the domain to do
 * anything. Nothing else is a prerequisite — the shipment records are read through an optional port, so
 * a tenant that ships without picking can still describe a building.
 */
const WAREHOUSE_DEPENDS_ON: string[] = ['@gauzy/plugin-inventory'];

/**
 * The unit references this package owns.
 *
 * A bin's three planning limits are quantities **in a stated unit**, so each of the three columns
 * names the unit its number is in. Declaring them here is what tells the kernel's audit — which owns
 * the rule that such a column must name a unit that exists — which columns the rule applies to. The
 * kernel cannot enumerate a package's schema, and a kernel migration that named `warehouse_bin` would
 * be the kernel naming a plugin's table.
 *
 * Two of the three fix their family and one does not, and the difference is what the column *means*.
 * A weight ceiling is a mass and a volume ceiling is a volume: a bin whose weight ceiling is
 * expressed in pieces is a number nothing can compare against a carrier's limit, and stating the
 * family here is what turns that into a nightly finding rather than into a shipment refused at the
 * loading dock. A capacity is different — a bin holds six pallets, forty cartons or two hundred
 * pieces, and the tenant's own vocabulary decides which — so no family is stated and only the
 * reference itself is checked.
 */
const WAREHOUSE_UNIT_REFERENCES: IUnitReference[] = [
	{
		table: 'warehouse_bin',
		column: 'capacityUnitId',
		owner: '@gauzy/plugin-warehouse',
		description: "The unit a bin's capacity is counted in, which may be a unit of any family."
	},
	{
		table: 'warehouse_bin',
		column: 'maxWeightUnitId',
		owner: '@gauzy/plugin-warehouse',
		category: UnitCategoryCode.MASS,
		description: "The unit a bin's weight ceiling is expressed in, which is a unit of mass."
	},
	{
		table: 'warehouse_bin',
		column: 'maxVolumeUnitId',
		owner: '@gauzy/plugin-warehouse',
		category: UnitCategoryCode.VOLUME,
		description: "The unit a bin's volume ceiling is expressed in, which is a unit of volume."
	}
];

/**
 * Warehouse management: the inside of a stock location, and the work of getting goods out of it.
 *
 * Seven tables over one question — where inside the building is it, who walks to fetch it, what went
 * into the parcel and what was handed to the carrier — placed in one package because they share the
 * layout, the numbering, the pick path and the custody boundary, and because a tenant adopts them
 * together or not at all.
 *
 * The location itself is not declared here: `warehouse` is an ERP concept the platform already had, and
 * this package adds what is *inside* it. The stock ledger is not declared here either. A bin's balance
 * is a derived number, every physical move this domain causes is a movement written through the
 * inventory capability, and no quantity is stored twice.
 */
@Plugin({
	/**
	 * An array of modules that will be imported and registered with the plugin.
	 */
	imports: [WarehouseModule],
	/**
	 * An array of Entity classes. The plugin (or ORM) will
	 * register these entities for use within the application.
	 */
	entities: [...ALL_WAREHOUSE_ENTITIES],
	/**
	 * The migrations this plugin owns. The platform merges them into the connection's migration list
	 * before the connection is created, so they run in timestamp order with every other package's. The
	 * fourth constrains the three unit references the third adds, and it is a file of its own because it
	 * may only run once the kernel's measurement set has created `unit`.
	 */
	migrations: [
		CreateWarehouseLayoutTables1791000000180,
		CreateWarehouseWorkTables1791000000190,
		AddWarehouseBinCapacityUnits1791000000195,
		AddWarehouseBinCapacityUnitForeignKeys1791000000196
	],
	/**
	 * The permissions the plugin contributes to the platform role model.
	 */
	permissions: [...WAREHOUSE_PERMISSIONS],
	/**
	 * The feature flag the plugin's endpoints are gated behind.
	 */
	features: [...WAREHOUSE_FEATURES],
	/**
	 * The plugin packages that must be loaded first.
	 */
	dependsOn: WAREHOUSE_DEPENDS_ON as unknown as Array<Type<any>>,
	/**
	 * The GraphQL surface this plugin contributes: its own types, its own root fields and its own
	 * resolvers, all composed into the one platform schema.
	 */
	extensions: {
		schema: schemaExtensions,
		resolvers
	}
})
export class WarehousePlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	// We disable by default additional logging for each event to avoid cluttering the logs
	private logEnabled = true;

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		// The three references are declared rather than only constrained, because a constraint this
		// dialect cannot attach — SQLite cannot add one to a column that already exists — would
		// otherwise leave nothing at all watching the column.
		registerUnitReferences(WAREHOUSE_UNIT_REFERENCES);

		if (this.logEnabled) {
			console.log(chalk.green(`${WarehousePlugin.name} is being bootstrapped...`));
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.red(`${WarehousePlugin.name} is being destroyed...`));
		}
	}
}
