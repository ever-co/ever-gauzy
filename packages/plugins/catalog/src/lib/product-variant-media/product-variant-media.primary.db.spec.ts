/**
 * R5-07: moving a variant's thumbnail, against the real `product_variant_media` table on better-sqlite3.
 *
 * `UQ_variant_media_primary` (`1791000000100`) admits one live primary row per variant, and Postgres and
 * SQLite check a unique index per statement. `setPrimary` and `replaceMedia` wrote the gallery one row at a
 * time, in the order `find()` returned the rows — no `ORDER BY` — or in the order the caller listed the
 * images. Whenever the new primary was written before the old one was cleared, the new row was set `true`
 * while the old one still was, the statement violated the index, the transaction rolled back and the caller
 * got an error. Because it depended on row order, it looked intermittent.
 *
 * The order is made deterministic here: the gallery's rows are read back with the **old primary last**, and
 * `replaceMedia` is called with the new primary listed **first** — the order that failed.
 *
 * **Nothing the defect lives in is doubled.** The table and its indexes are the catalog migration's own
 * SQLite DDL (run by the migration itself); the service is the real one over a TypeORM repository of that
 * database. `@gauzy/core` is doubled at the module boundary for the reason the package's other suites give
 * (its barrel boots the whole application); only the base class and the request context's readers stand in.
 */
jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;

	class BaseEntity {}

	class TenantAwareCrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}
	}

	return {
		TenantAwareCrudService,
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		ProductVariant: class ProductVariant {},
		ImageAsset: class ImageAsset {},
		RequestContext: {
			currentTenantId: () => TENANT,
			currentOrganizationId: () => ORG
		}
	};
});

const TENANT = '3c7e0000-0000-4000-8000-0000000000f1';
const ORG = '3c7e0000-0000-4000-8000-0000000000a1';

import 'reflect-metadata';
import { DataSource, EntitySchema } from 'typeorm';
import { CreateCatalogTables1791000000100 } from '../database/migrations/1791000000100-CreateCatalogTables';
import { ProductVariantMedia } from './product-variant-media.entity';
import { ProductVariantMediaService } from './product-variant-media.service';

const VARIANT = '3c7e0000-0000-4000-8000-0000000001a1';
const IMAGE_A = '3c7e0000-0000-4000-8000-0000000002a1';
const IMAGE_B = '3c7e0000-0000-4000-8000-0000000002b1';
const IMAGE_C = '3c7e0000-0000-4000-8000-0000000002c1';

/** The columns the service reads and writes; the table itself is the migration's. */
const TypeOrmProductVariantMedia = new EntitySchema<any>({
	name: 'ProductVariantMedia',
	target: ProductVariantMedia,
	tableName: 'product_variant_media',
	columns: {
		id: { type: 'varchar', primary: true, generated: 'uuid' },
		createdAt: { type: 'datetime', createDate: true },
		updatedAt: { type: 'datetime', updateDate: true },
		deletedAt: { type: 'datetime', nullable: true, deleteDate: true },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true },
		variantId: { type: 'varchar' },
		imageAssetId: { type: 'varchar' },
		position: { type: 'int', default: 0 },
		isPrimary: { type: 'boolean', default: false }
	}
});

describe('ProductVariantMediaService — moving the thumbnail under UQ_variant_media_primary (SQLite)', () => {
	let dataSource: DataSource;
	let service: ProductVariantMediaService;

	beforeEach(async () => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [TypeOrmProductVariantMedia],
			synchronize: false,
			logging: false
		});
		await dataSource.initialize();
		// The catalog's tables reference core tables (product_variant, image_asset, …) outside this fixture.
		await dataSource.query(`PRAGMA foreign_keys = OFF`);
		const queryRunner = dataSource.createQueryRunner();
		try {
			await new CreateCatalogTables1791000000100().up(queryRunner);
		} finally {
			await queryRunner.release();
		}

		const repository = dataSource.getRepository(ProductVariantMedia);
		service = new ProductVariantMediaService(repository as any, {} as any);

		// The gallery is read back with its current thumbnail LAST, which is the order that used to fail:
		// the loop then reached the new primary while the old one was still set.
		const find = repository.find.bind(repository);
		jest.spyOn(repository, 'find').mockImplementation(async (options?: any) => {
			const rows = await find(options);
			return [...rows].sort((a: any, b: any) => Number(a.isPrimary) - Number(b.isPrimary));
		});
	});

	afterEach(async () => {
		jest.restoreAllMocks();
		await dataSource?.destroy();
	});

	/** Inserts the gallery rows directly, in the given order, with the given image as the thumbnail. */
	async function gallery(images: string[], primary: string): Promise<void> {
		for (const [position, imageAssetId] of images.entries()) {
			await dataSource.query(
				`INSERT INTO "product_variant_media" ("id", "tenantId", "organizationId", "variantId", "imageAssetId", "position", "isPrimary") VALUES (?, ?, ?, ?, ?, ?, ?)`,
				[`${imageAssetId.slice(0, -3)}9${imageAssetId.slice(-2)}`, TENANT, ORG, VARIANT, imageAssetId, position, imageAssetId === primary ? 1 : 0]
			);
		}
	}

	/** The live gallery, as the database holds it, in display order. */
	async function rows(): Promise<Array<{ imageAssetId: string; position: number; isPrimary: number }>> {
		return dataSource.query(
			`SELECT "imageAssetId", "position", "isPrimary" FROM "product_variant_media" WHERE "variantId" = ? AND "deletedAt" IS NULL ORDER BY "position"`,
			[VARIANT]
		);
	}

	it('setPrimary moves the thumbnail when the current one is read after the new one', async () => {
		await gallery([IMAGE_A, IMAGE_B], IMAGE_B);

		await service.setPrimary(VARIANT, IMAGE_A);

		expect(await rows()).toEqual([
			{ imageAssetId: IMAGE_A, position: 0, isPrimary: 1 },
			{ imageAssetId: IMAGE_B, position: 1, isPrimary: 0 }
		]);
	});

	it('replaceMedia moves the thumbnail when the new one is listed before the current one', async () => {
		await gallery([IMAGE_A, IMAGE_B], IMAGE_A);

		await service.replaceMedia(VARIANT, [IMAGE_B, IMAGE_A], IMAGE_B);

		expect(await rows()).toEqual([
			{ imageAssetId: IMAGE_B, position: 0, isPrimary: 1 },
			{ imageAssetId: IMAGE_A, position: 1, isPrimary: 0 }
		]);
	});

	it('replaceMedia moves the thumbnail onto an image it adds', async () => {
		await gallery([IMAGE_A, IMAGE_B], IMAGE_B);

		await service.replaceMedia(VARIANT, [IMAGE_C, IMAGE_A, IMAGE_B], IMAGE_C);

		expect(await rows()).toEqual([
			{ imageAssetId: IMAGE_C, position: 0, isPrimary: 1 },
			{ imageAssetId: IMAGE_A, position: 1, isPrimary: 0 },
			{ imageAssetId: IMAGE_B, position: 2, isPrimary: 0 }
		]);
	});

	it('replaceMedia without a primary leaves the gallery with none', async () => {
		await gallery([IMAGE_A, IMAGE_B], IMAGE_B);

		await service.replaceMedia(VARIANT, [IMAGE_B, IMAGE_A]);

		expect((await rows()).map((row) => row.isPrimary)).toEqual([0, 0]);
	});

	it('setPrimary on the current thumbnail changes nothing', async () => {
		await gallery([IMAGE_A, IMAGE_B], IMAGE_B);

		await service.setPrimary(VARIANT, IMAGE_B);

		expect((await rows()).map((row) => row.isPrimary)).toEqual([0, 1]);
	});

	it('control: the index itself still refuses a second live thumbnail', async () => {
		await gallery([IMAGE_A, IMAGE_B], IMAGE_B);

		await expect(
			dataSource.query(`UPDATE "product_variant_media" SET "isPrimary" = 1 WHERE "imageAssetId" = ?`, [IMAGE_A])
		).rejects.toThrow(/UNIQUE constraint failed/);
	});
});
