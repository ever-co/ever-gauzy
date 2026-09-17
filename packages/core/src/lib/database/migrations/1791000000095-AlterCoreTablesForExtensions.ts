/**
 * Adds the additive columns the platform's own tables were extended with, and the indexes that serve
 * them.
 *
 * **Why this migration exists.** The capability packages of this programme were written against a
 * schema whose §2 extends fourteen tables the platform already owns rather than declaring parallel
 * copies of them: a payment is a payment, a supplier is a supplier, a stock level is a stock level.
 * The columns those extensions describe were declared on the core entities but no kernel migration
 * created them, and a column declared on an entity and absent from a migration exists only on an
 * installation that was synchronised from the entities — a clean install fails on the first read or
 * write that names it, because every query names every column. That is the defect this file closes.
 *
 * **Nothing here is destructive.** Every statement is an `ALTER TABLE … ADD COLUMN` of a column that is
 * either nullable or defaulted, so a populated installation keeps every row and every existing
 * behaviour: `enabled` stays authoritative for the legacy product API, `payment.amount` keeps its
 * accounting meaning, `taxes` stays the legacy tax fallback, and the pre-existing
 * `sequence`-numbered documents are untouched. `down()` reverses exactly what `up()` added.
 *
 * **Every addition is guarded.** `hasTable` skips a table this installation does not have, and
 * `hasColumn` skips a column that is already present, so the migration is a no-op on a database that
 * was synchronised from the entities. Index creation is guarded the same way, by asking each dialect's
 * own catalogue whether the index name is taken rather than by relying on `CREATE INDEX IF NOT EXISTS`
 * — MySQL has no such clause, and one behaviour on all three dialects is easier to review than two.
 * A second run of `up` therefore adds nothing: it issues the existence probes and no DDL at all.
 *
 * **Foreign keys are deliberately not created here.** A column whose target table is created by a later
 * migration set — `tax_category`, `price_list`, `unit`, `unit_category`, `payment_term`, `tax_regime`,
 * `order`, `payment_collection`, `payment_session`, `payment_provider`, `purchase_order_line`,
 * `warehouse_bin`, `seller` — is created **without** its constraint, and the set that creates the
 * target adds it. A kernel migration never waits for a package to be installed, and an installation
 * that never installs one still gets the column. The same rule is why the constraints on the columns
 * whose targets are core tables are not added here either: `product_category.parentId` and
 * `warehouse_product_variant.binId` are self- or package-referencing, and a kernel alteration is
 * additive only.
 *
 * **Dialect notes, each of which is a real difference rather than a convenience:**
 *
 * - **SQLite** takes the plain `ALTER TABLE … ADD COLUMN` path: every added column is nullable or
 *   carries a constant default, which is exactly the shape SQLite supports without rebuilding the
 *   table. A rebuild is therefore not needed, and no index has to be replayed — a rebuild that
 *   restates a table's DDL and forgets its indexes silently drops them, which is a failure this
 *   programme has already seen once.
 * - **Postgres** and **SQLite** both support filtered indexes, so the partial unique indexes are
 *   created with the predicate the schema specifies (`WHERE "deletedAt" IS NULL`, plus the null-guard
 *   the tuple needs).
 * - **MySQL** has no filtered index. Where the guard is a nullable column, the column is simply part
 *   of the unique tuple: MySQL treats `NULL` values as distinct, so unlimited null slugs coexist
 *   while a live slug stays unique. Where the guard is `"deletedAt" IS NULL` or a boolean, the
 *   fallback of the conventions chapter is used — a **stored generated key column** that is `'0'` while
 *   the row is live and the row id once it is deleted, so live rows collide on the key and deleted rows
 *   never do. Those generated columns exist on MySQL only, are not declared by any entity, and are the
 *   documented price of a filtered index on a dialect that has none.
 *
 * Deliberately **not** in this file, so a reviewer does not read the omission as an oversight:
 * `sequence.nextValue` widening to `bigint`, `sequence.padding`'s default changing to `6` and the
 * foreign key on `sequence.channelId` are alterations of an already-applied column on
 * `sequence`, and none of them can be expressed on SQLite without rebuilding the table and replaying
 * its two partial unique indexes. They belong to a migration of their own.
 */
import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * One column this migration adds, with the physical type it takes on each dialect.
 *
 * A definition that omits a dialect is a column that dialect does not get: the MySQL-only entries are
 * the generated key columns the partial unique indexes are expressed with there.
 */
interface ColumnDefinition {
	/** Postgres physical type. */
	postgres?: string;
	/** MySQL physical type. */
	mysql?: string;
	/** SQLite physical type. */
	sqlite?: string;
}

/**
 * One index this migration creates.
 *
 * The tuple is written once and rendered per dialect. SQLite inherits the Postgres body, because both
 * support a filtered index; MySQL needs its own body, because it does not.
 */
interface IndexDefinition {
	/** Index name. It is identical on every dialect, so a reviewer compares one line across the three. */
	name: string;
	/** Whether the index is unique. */
	unique?: boolean;
	/** Body after `ON <table>`: the quoted column tuple and any predicate. */
	postgres: string;
	/** The MySQL body: the same tuple without the predicate, or the generated-key fallback. */
	mysql: string;
	/** The SQLite body; it defaults to the Postgres one. */
	sqlite?: string;
}

/**
 * The columns every extended table gains, keyed by table.
 *
 * One entry per table, read by all three dialect bodies, so a column cannot be added on one dialect
 * and forgotten on another. The per-table counts are the counts of §2.
 */
const EXTENDED_COLUMNS: Record<string, Record<string, ColumnDefinition>> = {
	/** §2.1 — catalogue identity and lifecycle. */
	product: {
		slug: {
			postgres: 'character varying(255)',
			mysql: 'varchar(255) NULL',
			sqlite: 'varchar(255)'
		},
		status: {
			postgres: "character varying(16) NOT NULL DEFAULT 'ACTIVE'",
			mysql: "varchar(16) NOT NULL DEFAULT 'ACTIVE'",
			sqlite: "varchar(16) NOT NULL DEFAULT ('ACTIVE')"
		},
		publishedAt: { postgres: 'TIMESTAMP', mysql: 'datetime NULL', sqlite: 'datetime' },
		isFeatured: {
			postgres: 'boolean NOT NULL DEFAULT false',
			mysql: 'tinyint NOT NULL DEFAULT 0',
			sqlite: 'boolean NOT NULL DEFAULT (0)'
		},
		sortOrder: {
			postgres: 'integer NOT NULL DEFAULT 0',
			mysql: 'int NOT NULL DEFAULT 0',
			sqlite: 'integer NOT NULL DEFAULT (0)'
		},
		externalId: {
			postgres: 'character varying(255)',
			mysql: 'varchar(255) NULL',
			sqlite: 'varchar(255)'
		},
		metadata: { postgres: 'jsonb', mysql: 'json NULL', sqlite: 'text' },
		/** MySQL only: the generated key the filtered unique index on `(organizationId, slug)` needs. */
		deletedKey: {
			mysql: "varchar(36) GENERATED ALWAYS AS (IF(`deletedAt` IS NULL, '0', `id`)) STORED"
		}
	},

	/** §2.2 — the category tree and its lifecycle. */
	product_category: {
		parentId: { postgres: 'uuid', mysql: 'varchar(36) NULL', sqlite: 'varchar' },
		slug: {
			postgres: 'character varying(255)',
			mysql: 'varchar(255) NULL',
			sqlite: 'varchar(255)'
		},
		sortOrder: {
			postgres: 'integer NOT NULL DEFAULT 0',
			mysql: 'int NOT NULL DEFAULT 0',
			sqlite: 'integer NOT NULL DEFAULT (0)'
		},
		isFeatured: {
			postgres: 'boolean NOT NULL DEFAULT false',
			mysql: 'tinyint NOT NULL DEFAULT 0',
			sqlite: 'boolean NOT NULL DEFAULT (0)'
		},
		status: {
			postgres: "character varying(16) NOT NULL DEFAULT 'ACTIVE'",
			mysql: "varchar(16) NOT NULL DEFAULT 'ACTIVE'",
			sqlite: "varchar(16) NOT NULL DEFAULT ('ACTIVE')"
		},
		metadata: { postgres: 'jsonb', mysql: 'json NULL', sqlite: 'text' },
		/** MySQL only: the generated key the filtered unique index on `(organizationId, slug)` needs. */
		deletedKey: {
			mysql: "varchar(36) GENERATED ALWAYS AS (IF(`deletedAt` IS NULL, '0', `id`)) STORED"
		}
	},

	/** §2.3 — tax classification, trade data and the measurement units of the sellable unit. */
	product_variant: {
		taxCategoryId: { postgres: 'uuid', mysql: 'varchar(36) NULL', sqlite: 'varchar' },
		barcode: { postgres: 'character varying(64)', mysql: 'varchar(64) NULL', sqlite: 'varchar(64)' },
		weight: { postgres: 'numeric(12,4)', mysql: 'decimal(12,4) NULL', sqlite: 'numeric(12,4)' },
		isDefault: {
			postgres: 'boolean NOT NULL DEFAULT false',
			mysql: 'tinyint NOT NULL DEFAULT 0',
			sqlite: 'boolean NOT NULL DEFAULT (0)'
		},
		requiresShipping: {
			postgres: 'boolean NOT NULL DEFAULT true',
			mysql: 'tinyint NOT NULL DEFAULT 1',
			sqlite: 'boolean NOT NULL DEFAULT (1)'
		},
		position: {
			postgres: 'integer NOT NULL DEFAULT 0',
			mysql: 'int NOT NULL DEFAULT 0',
			sqlite: 'integer NOT NULL DEFAULT (0)'
		},
		externalId: {
			postgres: 'character varying(255)',
			mysql: 'varchar(255) NULL',
			sqlite: 'varchar(255)'
		},
		hsCode: { postgres: 'character varying(16)', mysql: 'varchar(16) NULL', sqlite: 'varchar(16)' },
		midCode: { postgres: 'character varying(32)', mysql: 'varchar(32) NULL', sqlite: 'varchar(32)' },
		originCountryCode: {
			postgres: 'character varying(2)',
			mysql: 'varchar(2) NULL',
			sqlite: 'varchar(2)'
		},
		material: {
			postgres: 'character varying(255)',
			mysql: 'varchar(255) NULL',
			sqlite: 'varchar(255)'
		},
		stockUnitId: { postgres: 'uuid', mysql: 'varchar(36) NULL', sqlite: 'varchar' },
		salesUnitId: { postgres: 'uuid', mysql: 'varchar(36) NULL', sqlite: 'varchar' },
		purchaseUnitId: { postgres: 'uuid', mysql: 'varchar(36) NULL', sqlite: 'varchar' },
		weightUnitId: { postgres: 'uuid', mysql: 'varchar(36) NULL', sqlite: 'varchar' },
		purchaseBillingPolicy: {
			postgres: 'character varying(16)',
			mysql: 'varchar(16) NULL',
			sqlite: 'varchar(16)'
		},
		metadata: { postgres: 'jsonb', mysql: 'json NULL', sqlite: 'text' },
		/** MySQL only: the keys the filtered unique indexes on this table need. */
		deletedKey: {
			mysql: "varchar(36) GENERATED ALWAYS AS (IF(`deletedAt` IS NULL, '0', `id`)) STORED"
		},
		isDefaultKey: {
			mysql: "varchar(1) GENERATED ALWAYS AS (IF(`isDefault`, '1', NULL)) STORED"
		}
	},

	/** §2.4 — what kind of stock location a warehouse is and what it may be used for. */
	warehouse: {
		type: {
			postgres: "character varying(16) NOT NULL DEFAULT 'WAREHOUSE'",
			mysql: "varchar(16) NOT NULL DEFAULT 'WAREHOUSE'",
			sqlite: "varchar(16) NOT NULL DEFAULT ('WAREHOUSE')"
		},
		priority: {
			postgres: 'integer NOT NULL DEFAULT 0',
			mysql: 'int NOT NULL DEFAULT 0',
			sqlite: 'integer NOT NULL DEFAULT (0)'
		},
		isPickupLocation: {
			postgres: 'boolean NOT NULL DEFAULT false',
			mysql: 'tinyint NOT NULL DEFAULT 0',
			sqlite: 'boolean NOT NULL DEFAULT (0)'
		},
		isFulfillmentLocation: {
			postgres: 'boolean NOT NULL DEFAULT true',
			mysql: 'tinyint NOT NULL DEFAULT 1',
			sqlite: 'boolean NOT NULL DEFAULT (1)'
		},
		latitude: { postgres: 'numeric(10,6)', mysql: 'decimal(10,6) NULL', sqlite: 'numeric(10,6)' },
		longitude: { postgres: 'numeric(10,6)', mysql: 'decimal(10,6) NULL', sqlite: 'numeric(10,6)' },
		timezone: { postgres: 'character varying(64)', mysql: 'varchar(64) NULL', sqlite: 'varchar(64)' },
		cutoffTime: { postgres: 'character varying(5)', mysql: 'varchar(5) NULL', sqlite: 'varchar(5)' },
		sellerId: { postgres: 'uuid', mysql: 'varchar(36) NULL', sqlite: 'varchar' },
		metadata: { postgres: 'jsonb', mysql: 'json NULL', sqlite: 'text' }
	},

	/** §2.5 — the product-level stock level. `reservedQuantity` already exists (1791000000090). */
	warehouse_product: {
		incomingQuantity: {
			postgres: 'numeric(20,6) NOT NULL DEFAULT 0',
			mysql: 'decimal(20,6) NOT NULL DEFAULT 0',
			sqlite: 'numeric(20,6) NOT NULL DEFAULT (0)'
		},
		safetyStock: {
			postgres: 'numeric(20,6) NOT NULL DEFAULT 0',
			mysql: 'decimal(20,6) NOT NULL DEFAULT 0',
			sqlite: 'numeric(20,6) NOT NULL DEFAULT (0)'
		},
		allowBackorder: {
			postgres: 'boolean NOT NULL DEFAULT false',
			mysql: 'tinyint NOT NULL DEFAULT 0',
			sqlite: 'boolean NOT NULL DEFAULT (0)'
		},
		backorderLimit: { postgres: 'numeric(20,6)', mysql: 'decimal(20,6) NULL', sqlite: 'numeric(20,6)' },
		restockThreshold: { postgres: 'numeric(20,6)', mysql: 'decimal(20,6) NULL', sqlite: 'numeric(20,6)' },
		trackInventory: {
			postgres: 'boolean NOT NULL DEFAULT true',
			mysql: 'tinyint NOT NULL DEFAULT 1',
			sqlite: 'boolean NOT NULL DEFAULT (1)'
		},
		isUnlimited: {
			postgres: 'boolean NOT NULL DEFAULT false',
			mysql: 'tinyint NOT NULL DEFAULT 0',
			sqlite: 'boolean NOT NULL DEFAULT (0)'
		},
		binLocation: { postgres: 'character varying(64)', mysql: 'varchar(64) NULL', sqlite: 'varchar(64)' },
		version: {
			postgres: 'integer NOT NULL DEFAULT 1',
			mysql: 'int NOT NULL DEFAULT 1',
			sqlite: 'integer NOT NULL DEFAULT (1)'
		},
		unitCategoryId: { postgres: 'uuid', mysql: 'varchar(36) NULL', sqlite: 'varchar' },
		metadata: { postgres: 'jsonb', mysql: 'json NULL', sqlite: 'text' }
	},

	/** §2.6 — the variant stock level; seven of its thirteen columns exist (1791000000090). */
	warehouse_product_variant: {
		restockThreshold: { postgres: 'numeric(20,6)', mysql: 'decimal(20,6) NULL', sqlite: 'numeric(20,6)' },
		trackInventory: {
			postgres: 'boolean NOT NULL DEFAULT true',
			mysql: 'tinyint NOT NULL DEFAULT 1',
			sqlite: 'boolean NOT NULL DEFAULT (1)'
		},
		binLocation: { postgres: 'character varying(64)', mysql: 'varchar(64) NULL', sqlite: 'varchar(64)' },
		binId: { postgres: 'uuid', mysql: 'varchar(36) NULL', sqlite: 'varchar' },
		unitCategoryId: { postgres: 'uuid', mysql: 'varchar(36) NULL', sqlite: 'varchar' },
		metadata: { postgres: 'jsonb', mysql: 'json NULL', sqlite: 'text' },
		/** MySQL only: the generated key the filtered unique index on the level tuple needs. */
		deletedKey: {
			mysql: "varchar(36) GENERATED ALWAYS AS (IF(`deletedAt` IS NULL, '0', `id`)) STORED"
		}
	},

	/** §2.7 — what the money layer has to know about a currency. */
	currency: {
		decimalPlaces: {
			postgres: 'integer NOT NULL DEFAULT 2',
			mysql: 'int NOT NULL DEFAULT 2',
			sqlite: 'integer NOT NULL DEFAULT (2)'
		},
		symbol: { postgres: 'character varying(8)', mysql: 'varchar(8) NULL', sqlite: 'varchar(8)' },
		symbolPosition: {
			postgres: "character varying(16) NOT NULL DEFAULT 'PREFIX'",
			mysql: "varchar(16) NOT NULL DEFAULT 'PREFIX'",
			sqlite: "varchar(16) NOT NULL DEFAULT ('PREFIX')"
		},
		symbolSpace: {
			postgres: 'boolean NOT NULL DEFAULT false',
			mysql: 'tinyint NOT NULL DEFAULT 0',
			sqlite: 'boolean NOT NULL DEFAULT (0)'
		},
		roundingMode: {
			postgres: "character varying(16) NOT NULL DEFAULT 'HALF_UP'",
			mysql: "varchar(16) NOT NULL DEFAULT 'HALF_UP'",
			sqlite: "varchar(16) NOT NULL DEFAULT ('HALF_UP')"
		},
		roundingIncrement: {
			postgres: 'numeric(20,6) NOT NULL DEFAULT 0',
			mysql: 'decimal(20,6) NOT NULL DEFAULT 0',
			sqlite: 'numeric(20,6) NOT NULL DEFAULT (0)'
		},
		isTender: {
			postgres: 'boolean NOT NULL DEFAULT true',
			mysql: 'tinyint NOT NULL DEFAULT 1',
			sqlite: 'boolean NOT NULL DEFAULT (1)'
		}
	},

	/** §2.8 — the party row: everything a commercial relationship needs to know. */
	organization_contact: {
		userId: { postgres: 'uuid', mysql: 'varchar(36) NULL', sqlite: 'varchar' },
		channelId: { postgres: 'uuid', mysql: 'varchar(36) NULL', sqlite: 'varchar' },
		status: {
			postgres: "character varying(16) NOT NULL DEFAULT 'ACTIVE'",
			mysql: "varchar(16) NOT NULL DEFAULT 'ACTIVE'",
			sqlite: "varchar(16) NOT NULL DEFAULT ('ACTIVE')"
		},
		priceListId: { postgres: 'uuid', mysql: 'varchar(36) NULL', sqlite: 'varchar' },
		taxExempt: {
			postgres: 'boolean NOT NULL DEFAULT false',
			mysql: 'tinyint NOT NULL DEFAULT 0',
			sqlite: 'boolean NOT NULL DEFAULT (0)'
		},
		taxCategoryId: { postgres: 'uuid', mysql: 'varchar(36) NULL', sqlite: 'varchar' },
		creditLimit: { postgres: 'numeric(20,6)', mysql: 'decimal(20,6) NULL', sqlite: 'numeric(20,6)' },
		creditUsed: {
			postgres: 'numeric(20,6) NOT NULL DEFAULT 0',
			mysql: 'decimal(20,6) NOT NULL DEFAULT 0',
			sqlite: 'numeric(20,6) NOT NULL DEFAULT (0)'
		},
		paymentTermsDays: { postgres: 'integer', mysql: 'int NULL', sqlite: 'integer' },
		loyaltyPoints: {
			postgres: 'numeric(20,6) NOT NULL DEFAULT 0',
			mysql: 'decimal(20,6) NOT NULL DEFAULT 0',
			sqlite: 'numeric(20,6) NOT NULL DEFAULT (0)'
		},
		defaultShippingAddressId: { postgres: 'uuid', mysql: 'varchar(36) NULL', sqlite: 'varchar' },
		defaultBillingAddressId: { postgres: 'uuid', mysql: 'varchar(36) NULL', sqlite: 'varchar' },
		acceptsMarketing: {
			postgres: 'boolean NOT NULL DEFAULT false',
			mysql: 'tinyint NOT NULL DEFAULT 0',
			sqlite: 'boolean NOT NULL DEFAULT (0)'
		},
		acquiredChannel: {
			postgres: 'character varying(64)',
			mysql: 'varchar(64) NULL',
			sqlite: 'varchar(64)'
		},
		emailKey: {
			postgres: 'character varying(320)',
			mysql: 'varchar(320) NULL',
			sqlite: 'varchar(320)'
		},
		externalId: {
			postgres: 'character varying(255)',
			mysql: 'varchar(255) NULL',
			sqlite: 'varchar(255)'
		},
		partyKind: {
			postgres: "character varying(16) NOT NULL DEFAULT 'INDIVIDUAL'",
			mysql: "varchar(16) NOT NULL DEFAULT 'INDIVIDUAL'",
			sqlite: "varchar(16) NOT NULL DEFAULT ('INDIVIDUAL')"
		},
		currency: { postgres: 'character varying(3)', mysql: 'varchar(3) NULL', sqlite: 'varchar(3)' },
		paymentTermId: { postgres: 'uuid', mysql: 'varchar(36) NULL', sqlite: 'varchar' },
		taxRegistrationNumber: {
			postgres: 'character varying(64)',
			mysql: 'varchar(64) NULL',
			sqlite: 'varchar(64)'
		},
		taxRegistrationScheme: {
			postgres: 'character varying(16)',
			mysql: 'varchar(16) NULL',
			sqlite: 'varchar(16)'
		},
		taxRegimeId: { postgres: 'uuid', mysql: 'varchar(36) NULL', sqlite: 'varchar' },
		metadata: { postgres: 'jsonb', mysql: 'json NULL', sqlite: 'text' },
		/** MySQL only: the generated key the two filtered unique indexes on this table need. */
		deletedKey: {
			mysql: "varchar(36) GENERATED ALWAYS AS (IF(`deletedAt` IS NULL, '0', `id`)) STORED"
		}
	},

	/** §2.9 — the scope a setting is addressed at and the structured value it carries. */
	tenant_setting: {
		organizationId: { postgres: 'uuid', mysql: 'varchar(36) NULL', sqlite: 'varchar' },
		channelId: { postgres: 'uuid', mysql: 'varchar(36) NULL', sqlite: 'varchar' },
		scope: {
			postgres: "character varying(16) NOT NULL DEFAULT 'TENANT'",
			mysql: "varchar(16) NOT NULL DEFAULT 'TENANT'",
			sqlite: "varchar(16) NOT NULL DEFAULT ('TENANT')"
		},
		valueJson: { postgres: 'jsonb', mysql: 'json NULL', sqlite: 'text' },
		valueType: {
			postgres: "character varying(16) NOT NULL DEFAULT 'STRING'",
			mysql: "varchar(16) NOT NULL DEFAULT 'STRING'",
			sqlite: "varchar(16) NOT NULL DEFAULT ('STRING')"
		},
		isEncrypted: {
			postgres: 'boolean NOT NULL DEFAULT false',
			mysql: 'tinyint NOT NULL DEFAULT 0',
			sqlite: 'boolean NOT NULL DEFAULT (0)'
		},
		description: {
			postgres: 'character varying(255)',
			mysql: 'varchar(255) NULL',
			sqlite: 'varchar(255)'
		},
		/** MySQL only: the keys the two filtered unique indexes on this table need. */
		deletedKey: {
			mysql: "varchar(36) GENERATED ALWAYS AS (IF(`deletedAt` IS NULL, '0', `id`)) STORED"
		},
		channelKey: {
			mysql: "varchar(36) GENERATED ALWAYS AS (IFNULL(`channelId`, '')) STORED"
		}
	},

	/** §2.10 — the four lifecycle amounts, the settlement snapshot and the document references. */
	payment: {
		orderId: { postgres: 'uuid', mysql: 'varchar(36) NULL', sqlite: 'varchar' },
		paymentCollectionId: { postgres: 'uuid', mysql: 'varchar(36) NULL', sqlite: 'varchar' },
		paymentSessionId: { postgres: 'uuid', mysql: 'varchar(36) NULL', sqlite: 'varchar' },
		paymentProviderId: { postgres: 'uuid', mysql: 'varchar(36) NULL', sqlite: 'varchar' },
		status: {
			postgres: "character varying(32) NOT NULL DEFAULT 'CAPTURED'",
			mysql: "varchar(32) NOT NULL DEFAULT 'CAPTURED'",
			sqlite: "varchar(32) NOT NULL DEFAULT ('CAPTURED')"
		},
		externalId: {
			postgres: 'character varying(255)',
			mysql: 'varchar(255) NULL',
			sqlite: 'varchar(255)'
		},
		reference: { postgres: 'character varying(64)', mysql: 'varchar(64) NULL', sqlite: 'varchar(64)' },
		authorizedAmount: { postgres: 'numeric(20,6)', mysql: 'decimal(20,6) NULL', sqlite: 'numeric(20,6)' },
		capturedAmount: {
			postgres: 'numeric(20,6) NOT NULL DEFAULT 0',
			mysql: 'decimal(20,6) NOT NULL DEFAULT 0',
			sqlite: 'numeric(20,6) NOT NULL DEFAULT (0)'
		},
		refundedAmount: {
			postgres: 'numeric(20,6) NOT NULL DEFAULT 0',
			mysql: 'decimal(20,6) NOT NULL DEFAULT 0',
			sqlite: 'numeric(20,6) NOT NULL DEFAULT (0)'
		},
		canceledAmount: {
			postgres: 'numeric(20,6) NOT NULL DEFAULT 0',
			mysql: 'decimal(20,6) NOT NULL DEFAULT 0',
			sqlite: 'numeric(20,6) NOT NULL DEFAULT (0)'
		},
		settlementCurrency: {
			postgres: 'character varying(3)',
			mysql: 'varchar(3) NULL',
			sqlite: 'varchar(3)'
		},
		settlementAmount: { postgres: 'numeric(20,6)', mysql: 'decimal(20,6) NULL', sqlite: 'numeric(20,6)' },
		fxRate: { postgres: 'numeric(20,10)', mysql: 'decimal(20,10) NULL', sqlite: 'numeric(20,10)' },
		fxRateId: { postgres: 'uuid', mysql: 'varchar(36) NULL', sqlite: 'varchar' },
		fxCapturedAt: { postgres: 'TIMESTAMP', mysql: 'datetime NULL', sqlite: 'datetime' },
		authorizedAt: { postgres: 'TIMESTAMP', mysql: 'datetime NULL', sqlite: 'datetime' },
		capturedAt: { postgres: 'TIMESTAMP', mysql: 'datetime NULL', sqlite: 'datetime' },
		canceledAt: { postgres: 'TIMESTAMP', mysql: 'datetime NULL', sqlite: 'datetime' },
		metadata: { postgres: 'jsonb', mysql: 'json NULL', sqlite: 'text' },
		/** MySQL only: the generated key the filtered unique index on `(paymentProviderId, externalId)` needs. */
		deletedKey: {
			mysql: "varchar(36) GENERATED ALWAYS AS (IF(`deletedAt` IS NULL, '0', `id`)) STORED"
		}
	},

	/** §2.10a — the commercial terms of the supplier master. */
	organization_vendor: {
		code: { postgres: 'character varying(64)', mysql: 'varchar(64) NULL', sqlite: 'varchar(64)' },
		currency: { postgres: 'character varying(3)', mysql: 'varchar(3) NULL', sqlite: 'varchar(3)' },
		paymentTermsDays: { postgres: 'integer', mysql: 'int NULL', sqlite: 'integer' },
		paymentTermId: { postgres: 'uuid', mysql: 'varchar(36) NULL', sqlite: 'varchar' },
		leadTimeDays: { postgres: 'integer', mysql: 'int NULL', sqlite: 'integer' },
		minimumOrderAmount: {
			postgres: 'numeric(20,6)',
			mysql: 'decimal(20,6) NULL',
			sqlite: 'numeric(20,6)'
		},
		contactId: { postgres: 'uuid', mysql: 'varchar(36) NULL', sqlite: 'varchar' },
		taxRegimeId: { postgres: 'uuid', mysql: 'varchar(36) NULL', sqlite: 'varchar' },
		metadata: { postgres: 'jsonb', mysql: 'json NULL', sqlite: 'text' },
		/** MySQL only: the generated key the filtered unique index on `(organizationId, code)` needs. */
		deletedKey: {
			mysql: "varchar(36) GENERATED ALWAYS AS (IF(`deletedAt` IS NULL, '0', `id`)) STORED"
		}
	},

	/** §2.10c — the schedule a finance document is settled against, and the vendor of a bill. */
	invoice: {
		paymentTermId: { postgres: 'uuid', mysql: 'varchar(36) NULL', sqlite: 'varchar' },
		vendorId: { postgres: 'uuid', mysql: 'varchar(36) NULL', sqlite: 'varchar' }
	},

	/** §2.10d — which ordered line a bill line settles. */
	invoice_item: {
		purchaseOrderLineId: { postgres: 'uuid', mysql: 'varchar(36) NULL', sqlite: 'varchar' }
	}
};

/**
 * The named indexes every extended table gains, keyed by table.
 *
 * The tuples are the ones §2 specifies, in the order it specifies them: the tenancy column leads, the
 * equality columns follow the ordering columns, and the predicate belongs to the index rather than to a
 * second filtered copy. A single-column index is listed here as well, because a partial unique index
 * and a plain index do not overlap.
 */
const EXTENDED_INDEXES: Record<string, IndexDefinition[]> = {
	product: [
		{
			name: 'UQ_product_org_slug',
			unique: true,
			postgres: '("organizationId", "slug") WHERE "slug" IS NOT NULL AND "deletedAt" IS NULL',
			mysql: '(`organizationId`, `slug`, `deletedKey`)'
		},
		{
			name: 'IDX_product_org_status',
			postgres: '("organizationId", "status") WHERE "deletedAt" IS NULL',
			mysql: '(`organizationId`, `status`)'
		},
		{
			name: 'IDX_product_org_featured_sort',
			postgres: '("organizationId", "isFeatured", "sortOrder") WHERE "deletedAt" IS NULL',
			mysql: '(`organizationId`, `isFeatured`, `sortOrder`)'
		},
		{
			name: 'IDX_product_org_external',
			postgres: '("organizationId", "externalId") WHERE "externalId" IS NOT NULL',
			mysql: '(`organizationId`, `externalId`)'
		}
	],
	product_category: [
		{
			name: 'UQ_product_category_org_slug',
			unique: true,
			postgres: '("organizationId", "slug") WHERE "slug" IS NOT NULL AND "deletedAt" IS NULL',
			mysql: '(`organizationId`, `slug`, `deletedKey`)'
		},
		{
			name: 'IDX_product_category_org_parent_sort',
			postgres: '("organizationId", "parentId", "sortOrder") WHERE "deletedAt" IS NULL',
			mysql: '(`organizationId`, `parentId`, `sortOrder`)'
		},
		{
			name: 'IDX_product_category_org_status',
			postgres: '("organizationId", "status") WHERE "deletedAt" IS NULL',
			mysql: '(`organizationId`, `status`)'
		}
	],
	product_variant: [
		{
			name: 'IDX_product_variant_product_position',
			postgres: '("productId", "position") WHERE "deletedAt" IS NULL',
			mysql: '(`productId`, `position`)'
		},
		{
			name: 'IDX_product_variant_org_barcode',
			postgres: '("organizationId", "barcode") WHERE "barcode" IS NOT NULL',
			mysql: '(`organizationId`, `barcode`)'
		},
		{ name: 'IDX_product_variant_tax_category', postgres: '("taxCategoryId")', mysql: '(`taxCategoryId`)' },
		{
			name: 'UQ_product_variant_default',
			unique: true,
			postgres: '("productId") WHERE "isDefault" = true AND "deletedAt" IS NULL',
			mysql: '(`productId`, `isDefaultKey`, `deletedKey`)'
		},
		{
			name: 'UQ_product_variant_org_external',
			unique: true,
			postgres: '("organizationId", "externalId") WHERE "externalId" IS NOT NULL AND "deletedAt" IS NULL',
			mysql: '(`organizationId`, `externalId`, `deletedKey`)'
		},
		{
			name: 'IDX_product_variant_org_hs_code',
			postgres: '("organizationId", "hsCode") WHERE "hsCode" IS NOT NULL AND "deletedAt" IS NULL',
			mysql: '(`organizationId`, `hsCode`)'
		},
		{
			name: 'IDX_product_variant_stock_unit',
			postgres: '("stockUnitId") WHERE "deletedAt" IS NULL',
			mysql: '(`stockUnitId`)'
		},
		{
			name: 'IDX_product_variant_sales_unit',
			postgres: '("salesUnitId") WHERE "salesUnitId" IS NOT NULL',
			mysql: '(`salesUnitId`)'
		},
		{
			name: 'IDX_product_variant_weight_unit',
			postgres: '("weightUnitId") WHERE "weightUnitId" IS NOT NULL',
			mysql: '(`weightUnitId`)'
		}
	],
	warehouse: [
		{
			name: 'IDX_warehouse_org_type_priority',
			postgres: '("organizationId", "type", "priority") WHERE "deletedAt" IS NULL',
			mysql: '(`organizationId`, `type`, `priority`)'
		},
		{
			name: 'IDX_warehouse_org_fulfillment',
			postgres: '("organizationId", "isFulfillmentLocation") WHERE "deletedAt" IS NULL',
			mysql: '(`organizationId`, `isFulfillmentLocation`)'
		},
		{
			name: 'IDX_warehouse_seller',
			postgres: '("sellerId", "isFulfillmentLocation") WHERE "sellerId" IS NOT NULL AND "deletedAt" IS NULL',
			mysql: '(`sellerId`, `isFulfillmentLocation`)'
		}
	],
	warehouse_product: [
		{
			name: 'IDX_warehouse_product_warehouse_qty',
			postgres: '("warehouseId", "quantity") WHERE "deletedAt" IS NULL',
			mysql: '(`warehouseId`, `quantity`)'
		},
		{
			name: 'IDX_warehouse_product_org_restock',
			postgres: '("organizationId", "trackInventory", "restockThreshold") WHERE "deletedAt" IS NULL',
			mysql: '(`organizationId`, `trackInventory`, `restockThreshold`)'
		}
	],
	warehouse_product_variant: [
		{
			name: 'IDX_warehouse_product_variant_variant_qty',
			postgres: '("variantId", "quantity") WHERE "deletedAt" IS NULL',
			mysql: '(`variantId`, `quantity`)'
		},
		{ name: 'IDX_warehouse_product_variant_wp', postgres: '("warehouseProductId")', mysql: '(`warehouseProductId`)' },
		{
			name: 'IDX_warehouse_product_variant_org_restock',
			postgres: '("organizationId", "trackInventory", "restockThreshold") WHERE "deletedAt" IS NULL',
			mysql: '(`organizationId`, `trackInventory`, `restockThreshold`)'
		},
		{
			name: 'UQ_warehouse_product_variant_level',
			unique: true,
			postgres: '("warehouseProductId", "variantId") WHERE "deletedAt" IS NULL',
			mysql: '(`warehouseProductId`, `variantId`, `deletedKey`)'
		}
	],
	currency: [
		{ name: 'IDX_currency_active_decimal', postgres: '("isActive", "decimalPlaces")', mysql: '(`isActive`, `decimalPlaces`)' },
		{ name: 'IDX_currency_active_tender', postgres: '("isActive", "isTender")', mysql: '(`isActive`, `isTender`)' }
	],
	organization_contact: [
		{
			name: 'UQ_organization_contact_org_external',
			unique: true,
			postgres: '("organizationId", "externalId") WHERE "externalId" IS NOT NULL AND "deletedAt" IS NULL',
			mysql: '(`organizationId`, `externalId`, `deletedKey`)'
		},
		{
			name: 'UQ_organization_contact_org_email',
			unique: true,
			postgres: '("organizationId", "emailKey") WHERE "emailKey" IS NOT NULL AND "deletedAt" IS NULL',
			mysql: '(`organizationId`, `emailKey`, `deletedKey`)'
		},
		{
			name: 'IDX_organization_contact_email_lookup',
			postgres: '("tenantId", "emailKey") WHERE "emailKey" IS NOT NULL AND "deletedAt" IS NULL',
			mysql: '(`tenantId`, `emailKey`)'
		},
		{
			name: 'IDX_organization_contact_org_status',
			postgres: '("organizationId", "status") WHERE "deletedAt" IS NULL',
			mysql: '(`organizationId`, `status`)'
		},
		{
			name: 'IDX_organization_contact_user',
			postgres: '("userId") WHERE "userId" IS NOT NULL',
			mysql: '(`userId`)'
		},
		{
			name: 'IDX_organization_contact_price_list',
			postgres: '("priceListId") WHERE "priceListId" IS NOT NULL',
			mysql: '(`priceListId`)'
		},
		{
			name: 'IDX_organization_contact_tax_category',
			postgres: '("taxCategoryId") WHERE "taxCategoryId" IS NOT NULL',
			mysql: '(`taxCategoryId`)'
		},
		{
			name: 'IDX_organization_contact_org_kind',
			postgres: '("organizationId", "partyKind") WHERE "deletedAt" IS NULL',
			mysql: '(`organizationId`, `partyKind`)'
		},
		{
			name: 'IDX_organization_contact_payment_term',
			postgres: '("paymentTermId") WHERE "paymentTermId" IS NOT NULL',
			mysql: '(`paymentTermId`)'
		},
		{
			name: 'IDX_organization_contact_tax_regime',
			postgres: '("taxRegimeId") WHERE "taxRegimeId" IS NOT NULL',
			mysql: '(`taxRegimeId`)'
		}
	],
	tenant_setting: [
		{
			name: 'UQ_tenant_setting_org_scope_name',
			unique: true,
			postgres:
				'("organizationId", "scope", "name") WHERE "organizationId" IS NOT NULL AND "channelId" IS NULL AND "deletedAt" IS NULL',
			mysql: '(`organizationId`, `scope`, `name`, `channelKey`, `deletedKey`)'
		},
		{
			name: 'UQ_tenant_setting_org_scope_channel_name',
			unique: true,
			postgres:
				'("organizationId", "scope", "channelId", "name") WHERE "channelId" IS NOT NULL AND "deletedAt" IS NULL',
			mysql: '(`organizationId`, `scope`, `name`, `channelKey`, `deletedKey`)'
		},
		{
			name: 'IDX_tenant_setting_tenant_name',
			postgres: '("tenantId", "name") WHERE "deletedAt" IS NULL',
			mysql: '(`tenantId`, `name`)'
		},
		{
			name: 'IDX_tenant_setting_channel',
			postgres: '("channelId") WHERE "channelId" IS NOT NULL',
			mysql: '(`channelId`)'
		}
	],
	payment: [
		{
			name: 'IDX_payment_order',
			postgres: '("orderId", "status") WHERE "orderId" IS NOT NULL AND "deletedAt" IS NULL',
			mysql: '(`orderId`, `status`)'
		},
		{
			name: 'IDX_payment_collection',
			postgres: '("paymentCollectionId", "status") WHERE "paymentCollectionId" IS NOT NULL AND "deletedAt" IS NULL',
			mysql: '(`paymentCollectionId`, `status`)'
		},
		{
			name: 'IDX_payment_provider',
			postgres: '("paymentProviderId", "status") WHERE "paymentProviderId" IS NOT NULL',
			mysql: '(`paymentProviderId`, `status`)'
		},
		{
			name: 'IDX_payment_session',
			postgres: '("paymentSessionId") WHERE "paymentSessionId" IS NOT NULL',
			mysql: '(`paymentSessionId`)'
		},
		{
			name: 'IDX_payment_org_created',
			postgres: '("organizationId", "createdAt") WHERE "deletedAt" IS NULL',
			mysql: '(`organizationId`, `createdAt`)'
		},
		{
			name: 'UQ_payment_external',
			unique: true,
			postgres:
				'("paymentProviderId", "externalId") WHERE "externalId" IS NOT NULL AND "paymentProviderId" IS NOT NULL AND "deletedAt" IS NULL',
			mysql: '(`paymentProviderId`, `externalId`, `deletedKey`)'
		}
	],
	organization_vendor: [
		{
			name: 'UQ_organization_vendor_org_code',
			unique: true,
			postgres: '("organizationId", "code") WHERE "code" IS NOT NULL AND "deletedAt" IS NULL',
			mysql: '(`organizationId`, `code`, `deletedKey`)'
		},
		{
			name: 'IDX_organization_vendor_contact',
			postgres: '("contactId") WHERE "contactId" IS NOT NULL AND "deletedAt" IS NULL',
			mysql: '(`contactId`)'
		},
		{
			name: 'IDX_organization_vendor_payment_term',
			postgres: '("paymentTermId") WHERE "paymentTermId" IS NOT NULL',
			mysql: '(`paymentTermId`)'
		},
		{
			name: 'IDX_organization_vendor_tax_regime',
			postgres: '("taxRegimeId") WHERE "taxRegimeId" IS NOT NULL',
			mysql: '(`taxRegimeId`)'
		}
	],
	invoice: [
		{
			name: 'IDX_invoice_payment_term',
			postgres: '("paymentTermId") WHERE "paymentTermId" IS NOT NULL',
			mysql: '(`paymentTermId`)'
		},
		{
			name: 'IDX_invoice_vendor',
			postgres: '("vendorId", "status") WHERE "vendorId" IS NOT NULL AND "deletedAt" IS NULL',
			mysql: '(`vendorId`, `status`)'
		}
	],
	invoice_item: [
		{
			name: 'IDX_invoice_item_purchase_line',
			postgres: '("purchaseOrderLineId") WHERE "purchaseOrderLineId" IS NOT NULL',
			mysql: '(`purchaseOrderLineId`)'
		}
	]
};

/**
 * Adds the additive columns of §2 and the indexes that serve them, on all three dialects.
 */
export class AlterCoreTablesForExtensions1791000000095 implements MigrationInterface {
	name = 'AlterCoreTablesForExtensions1791000000095';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				await this.sqliteUpQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.postgres:
				await this.postgresUpQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.mysql:
				await this.mysqlUpQueryRunner(queryRunner);
				break;
			default:
				throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}

	/**
	 * Down Migration
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));

		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				await this.sqliteDownQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.postgres:
				await this.postgresDownQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.mysql:
				await this.mysqlDownQueryRunner(queryRunner);
				break;
			default:
				throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}

	/**
	 * PostgresDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.extend(queryRunner, DatabaseTypeEnum.postgres);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.revert(queryRunner, DatabaseTypeEnum.postgres);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.extend(queryRunner, DatabaseTypeEnum.sqlite);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.revert(queryRunner, DatabaseTypeEnum.sqlite);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.extend(queryRunner, DatabaseTypeEnum.mysql);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.revert(queryRunner, DatabaseTypeEnum.mysql);
	}

	/**
	 * Adds every column and then every index, because an index needs the columns it names.
	 *
	 * @param queryRunner
	 * @param dialect The dialect whose physical types are used.
	 */
	private async extend(queryRunner: QueryRunner, dialect: DatabaseTypeEnum): Promise<void> {
		for (const [table, columns] of Object.entries(EXTENDED_COLUMNS)) {
			await this.addColumns(queryRunner, table, columns, dialect);
		}

		for (const [table, indexes] of Object.entries(EXTENDED_INDEXES)) {
			await this.createIndexes(queryRunner, table, indexes, dialect);
		}
	}

	/**
	 * Reverses `extend`: every index first, then every column it named.
	 *
	 * The order is not cosmetic. A filtered index that names a column blocks the column's removal on
	 * every dialect, and on MySQL a generated column cannot be dropped while an index uses it.
	 *
	 * @param queryRunner
	 * @param dialect The dialect whose physical types were used.
	 */
	private async revert(queryRunner: QueryRunner, dialect: DatabaseTypeEnum): Promise<void> {
		for (const [table, indexes] of Object.entries(EXTENDED_INDEXES)) {
			await this.dropIndexes(queryRunner, table, indexes, dialect);
		}

		for (const [table, columns] of Object.entries(EXTENDED_COLUMNS)) {
			await this.dropColumns(queryRunner, table, columns, dialect);
		}
	}

	/**
	 * Adds the columns of one table that the dialect has not been given yet.
	 *
	 * Two guards, and both matter: a table this installation does not have is skipped entirely, and a
	 * column that is already present is skipped rather than added twice — an installation synchronised
	 * from the entities already has every one of them. A definition with no type for the dialect is a
	 * column that dialect does not get, which is how the MySQL-only generated keys are expressed.
	 *
	 * @param queryRunner
	 * @param table The table to extend.
	 * @param columns The columns it gains, keyed by column name.
	 * @param dialect The dialect whose physical types are used.
	 */
	private async addColumns(
		queryRunner: QueryRunner,
		table: string,
		columns: Record<string, ColumnDefinition>,
		dialect: DatabaseTypeEnum
	): Promise<void> {
		if (!(await queryRunner.hasTable(table))) {
			return;
		}

		for (const [column, definition] of Object.entries(columns)) {
			const type = this.typeOf(definition, dialect);

			if (!type || (await queryRunner.hasColumn(table, column))) {
				continue;
			}

			await queryRunner.query(
				`ALTER TABLE ${this.quote(table, dialect)} ADD COLUMN ${this.quote(column, dialect)} ${type}`
			);
		}
	}

	/**
	 * Drops the columns of one table that the dialect was given, and only those.
	 *
	 * @param queryRunner
	 * @param table The table to shrink back.
	 * @param columns The columns it gained.
	 * @param dialect The dialect whose physical types were used.
	 */
	private async dropColumns(
		queryRunner: QueryRunner,
		table: string,
		columns: Record<string, ColumnDefinition>,
		dialect: DatabaseTypeEnum
	): Promise<void> {
		if (!(await queryRunner.hasTable(table))) {
			return;
		}

		for (const [column, definition] of Object.entries(columns)) {
			if (!this.typeOf(definition, dialect) || !(await queryRunner.hasColumn(table, column))) {
				continue;
			}

			await queryRunner.query(`ALTER TABLE ${this.quote(table, dialect)} DROP COLUMN ${this.quote(column, dialect)}`);
		}
	}

	/**
	 * Creates the indexes of one table that are not already there.
	 *
	 * Every dialect is asked whether the name is taken before it is used, rather than relying on
	 * `CREATE INDEX IF NOT EXISTS`: MySQL has no such clause, and one behaviour on all three dialects
	 * is easier to review than two. The probe is the only statement a second run of `up` issues.
	 *
	 * @param queryRunner
	 * @param table The indexed table.
	 * @param indexes The indexes it gains.
	 * @param dialect The dialect whose body is used.
	 */
	private async createIndexes(
		queryRunner: QueryRunner,
		table: string,
		indexes: IndexDefinition[],
		dialect: DatabaseTypeEnum
	): Promise<void> {
		if (!(await queryRunner.hasTable(table))) {
			return;
		}

		for (const index of indexes) {
			if (await this.indexExists(queryRunner, table, index.name, dialect)) {
				continue;
			}

			const body = dialect === DatabaseTypeEnum.mysql ? index.mysql : index.sqlite ?? index.postgres;

			await queryRunner.query(
				`CREATE ${index.unique ? 'UNIQUE ' : ''}INDEX ${this.quote(index.name, dialect)} ON ${this.quote(
					table,
					dialect
				)} ${body}`
			);
		}
	}

	/**
	 * Drops the indexes of one table that are present.
	 *
	 * @param queryRunner
	 * @param table The indexed table.
	 * @param indexes The indexes it gained.
	 * @param dialect The dialect the indexes were created on.
	 */
	private async dropIndexes(
		queryRunner: QueryRunner,
		table: string,
		indexes: IndexDefinition[],
		dialect: DatabaseTypeEnum
	): Promise<void> {
		if (!(await queryRunner.hasTable(table))) {
			return;
		}

		for (const index of indexes) {
			if (!(await this.indexExists(queryRunner, table, index.name, dialect))) {
				continue;
			}

			await queryRunner.query(
				dialect === DatabaseTypeEnum.mysql
					? `DROP INDEX ${this.quote(index.name, dialect)} ON ${this.quote(table, dialect)}`
					: `DROP INDEX ${this.quote(index.name, dialect)}`
			);
		}
	}

	/**
	 * The physical type a column takes on a dialect, or undefined when the dialect does not get it.
	 *
	 * @param definition The column's per-dialect types.
	 * @param dialect The dialect in use.
	 * @returns The type, or undefined.
	 */
	private typeOf(definition: ColumnDefinition, dialect: DatabaseTypeEnum): string | undefined {
		switch (dialect) {
			case DatabaseTypeEnum.postgres:
				return definition.postgres;
			case DatabaseTypeEnum.mysql:
				return definition.mysql;
			default:
				return definition.sqlite;
		}
	}

	/**
	 * Quotes an identifier the way the dialect does.
	 *
	 * @param identifier The table or column name.
	 * @param dialect The dialect in use.
	 * @returns The quoted identifier.
	 */
	private quote(identifier: string, dialect: DatabaseTypeEnum): string {
		return dialect === DatabaseTypeEnum.mysql ? `\`${identifier}\`` : `"${identifier}"`;
	}

	/**
	 * Whether a table already carries an index of this name.
	 *
	 * The catalogue is dialect-specific and is read rather than guessed: an index on this platform is
	 * created by a migration, by the ORM's own synchronise run or by the ORM's generated history, and
	 * the name is the only thing all three agree on.
	 *
	 * @param queryRunner
	 * @param table The table the index belongs to.
	 * @param name The index name.
	 * @param dialect The dialect in use.
	 * @returns True when the index exists.
	 */
	private async indexExists(
		queryRunner: QueryRunner,
		table: string,
		name: string,
		dialect: DatabaseTypeEnum
	): Promise<boolean> {
		if (dialect === DatabaseTypeEnum.mysql) {
			return this.rowsExist(
				await queryRunner.query(
					`SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1`,
					[table, name]
				)
			);
		}

		if (dialect === DatabaseTypeEnum.postgres) {
			return this.rowsExist(
				await queryRunner.query(
					`SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND indexname = $1 LIMIT 1`,
					[name]
				)
			);
		}

		return this.rowsExist(
			await queryRunner.query(`SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ? LIMIT 1`, [name])
		);
	}

	/**
	 * Whether a probe returned a row.
	 *
	 * @param rows Whatever the driver returned.
	 * @returns True when at least one row came back.
	 */
	private rowsExist(rows: unknown): boolean {
		return Array.isArray(rows) && rows.length > 0;
	}
}
