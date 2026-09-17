/**
 * `@gauzy/core` boots the whole application graph from its barrel — the configuration, the ORM, the
 * job registry, the module scanner — none of which a gallery service needs and none of which is
 * available outside a running application. The seam is therefore doubled at the module boundary,
 * exactly as the order and cart packages' service specs do, and **the service under test is the real
 * one**: only the base CRUD class, the request context and the entity base classes are substituted.
 */
jest.mock('@gauzy/core', () => {
	const { NotFoundException } = require('@nestjs/common');

	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	class TenantAwareCrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}

		get ormType(): string {
			return 'typeorm';
		}

		async findAll(options: any = {}): Promise<any> {
			const [items, total] = await this.typeOrmRepository.findAndCount(options);

			return { items, total };
		}

		async find(options: any = {}): Promise<any> {
			return this.typeOrmRepository.find(options);
		}

		async paginate(options: any = {}): Promise<any> {
			const [items, total] = await this.typeOrmRepository.findAndCount(options);

			return { items, total };
		}

		async findOneByIdString(id: any, options: any = {}): Promise<any> {
			if (!id) {
				throw new NotFoundException('The requested record was not found');
			}

			const record = await this.typeOrmRepository.findOne({
				...options,
				where: { ...(options.where ?? {}), id }
			});

			if (!record) {
				throw new NotFoundException('The requested record was not found');
			}

			return record;
		}

		async findOneByWhereOptions(where: any): Promise<any> {
			const record = await this.typeOrmRepository.findOneBy(where);

			if (!record) {
				throw new NotFoundException('The requested record was not found');
			}

			return record;
		}

		async create(entity: any): Promise<any> {
			return this.typeOrmRepository.save(this.typeOrmRepository.create(entity));
		}

		async update(id: any, partial: any): Promise<any> {
			if (typeof id === 'string') {
				await this.findOneByIdString(id);
			}

			return this.typeOrmRepository.update(id, partial);
		}

		async delete(criteria: any): Promise<any> {
			return this.typeOrmRepository.delete(criteria);
		}
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
		JsonColumn: decorator,
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		BaseEvent: class {},
		EventBus: class {},
		Product: class {},
		ProductVariant: class {},
		Tag: class {},
		ImageAsset: class {},
		OrganizationContact: class {},
		Warehouse: class {},
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => null,
			currentOrganizationId: () => null,
			currentEmployeeId: () => null,
			hasPermission: () => false
		}
	};
});

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { RequestContext } from '@gauzy/core';
import { ProductVariantMedia } from './product-variant-media.entity';
import { ProductVariantMediaService } from './product-variant-media.service';

/**
 * A variant's gallery.
 *
 * The gallery is the ordered set of images a variant is shown with, and the thumbnail is the one of
 * them a listing uses, so the properties the schema fixes are (doc 05 §4.8):
 *
 * - an image appears **at most once** per variant, and the gallery is written as a set: replacing it
 *   writes the order in one transaction, and the rows that are still in it keep their identity;
 * - **at most one image per variant is the primary one**, and "at most one" is enforced here rather
 *   than by the caller — promoting a thumbnail clears the previous one, and detaching the thumbnail
 *   promotes the first remaining image, so a gallery is never left with two thumbnails or with none;
 * - an operation that **names an image the variant does not carry is refused** rather than silently
 *   ignored: a promotion, a detachment or a thumbnail choice that names an unknown image is a stated
 *   miss (`404` / `400`), because a caller whose reorder was quietly dropped would believe a gallery
 *   it never got.
 *
 * The service is constructed directly with an in-memory double of its repository, wired to the
 * manager it writes through. The double applies the `where` and the `order` the service states, so a
 * read that stopped narrowing to its variant or stopped ordering by position is caught here.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
const VARIANT = '00000000-0000-4000-8000-000000000010';
const OTHER_VARIANT = '00000000-0000-4000-8000-000000000011';
const FRONT = '00000000-0000-4000-8000-000000000021';
const SIDE = '00000000-0000-4000-8000-000000000022';
const DETAIL = '00000000-0000-4000-8000-000000000023';
const FOREIGN = '00000000-0000-4000-8000-000000000024';

/** The tables this suite drives, as plain arrays. */
interface ITables {
	product_variant_media: any[];
}

/** One `product_variant_media` row. */
const mediaRow = (id: string, imageAssetId: string, position: number, overrides: Record<string, unknown> = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	variantId: VARIANT,
	imageAssetId,
	position,
	isPrimary: false,
	...overrides
});

/**
 * The manager double: the statements the gallery write issues, keyed by the entity they name.
 *
 * @param tables The whole datastore.
 * @param entityToTable The table each entity class writes.
 */
function manager(tables: ITables, entityToTable: Map<unknown, keyof ITables>) {
	let sequence = 0;
	const rows = (entity: unknown) => {
		const table = entityToTable.get(entity);

		if (!table) {
			throw new Error('the in-memory double was handed an entity it does not know');
		}

		return tables[table];
	};
	const same = (left: unknown, right: unknown) => String(left ?? '') === String(right ?? '');
	const ordered = (found: any[], order?: Record<string, 'ASC' | 'DESC'>) => {
		const columns = Object.keys(order ?? {});

		if (!columns.length) {
			return found;
		}

		return [...found].sort((left, right) => {
			for (const column of columns) {
				if (left[column] === right[column]) {
					continue;
				}

				const direction = order?.[column] === 'DESC' ? -1 : 1;

				return (left[column] > right[column] ? 1 : -1) * direction;
			}

			return 0;
		});
	};
	/** The whole datastore, copied row by row, so a failed transaction can put it back. */
	const snapshot = () =>
		Object.fromEntries(
			Object.entries(tables).map(([table, tableRows]) => [table, tableRows.map((row) => ({ ...row }))])
		);
	const restore = (copy: Record<string, any[]>) => {
		for (const [table, tableRows] of Object.entries(copy)) {
			(tables as unknown as Record<string, any[]>)[table] = tableRows;
		}
	};

	const writeManager: any = {
		rows,
		/**
		 * The transaction the write path asks for: the callback sees the same datastore, and a throw
		 * from anywhere inside it leaves the datastore exactly as it was — which is the property every
		 * "nothing was written" assertion below depends on.
		 */
		transaction: async (run: (manager: any) => Promise<any>) => {
			const copy = snapshot();

			try {
				return await run(writeManager);
			} catch (error) {
				restore(copy);
				throw error;
			}
		},
		create: (entity: unknown, partial: any) => ({ ...partial }),
		save: async (entity: unknown, row: any) => {
			const table = rows(entity);
			const index = table.findIndex((candidate) => same(candidate.id, row.id));

			if (index >= 0) {
				table[index] = { ...table[index], ...row };

				return table[index];
			}

			table.push(row);

			return row;
		},
		find: async (entity: unknown, options: any = {}) =>
			ordered(
				rows(entity).filter((row: any) =>
					Object.entries(options.where ?? {}).every(([field, expected]) => same(row[field], expected))
				),
				options.order
			),
		findOne: async (entity: unknown, options: any = {}) =>
			rows(entity).find((row: any) =>
				Object.entries(options.where ?? {}).every(([field, expected]) => same(row[field], expected))
			) ?? null,
		insert: async (entity: unknown, partial: any) => {
			rows(entity).push({ id: `inserted-${++sequence}`, ...partial });

			return partial;
		},
		update: async (entity: unknown, id: unknown, patch: any) => {
			const row = rows(entity).find((candidate: any) => same(candidate.id, id));

			if (row) {
				Object.assign(row, patch);
			}

			return { affected: row ? 1 : 0 };
		},
		delete: async (entity: unknown, criteria: unknown) => {
			const ids = Array.isArray(criteria) ? criteria : [criteria];
			const table = rows(entity);
			let affected = 0;

			for (const id of ids) {
				const index = table.findIndex((candidate: any) => same(candidate.id, id));

				if (index >= 0) {
					table.splice(index, 1);
					affected += 1;
				}
			}

			return { affected };
		}
	};

	return writeManager;
}

/**
 * An in-memory stand-in for one table's TypeORM repository.
 *
 * @param tables The whole datastore.
 * @param tableName The table this repository writes.
 * @param writeManager The manager the service reaches through `repository.manager`.
 */
function repository(tables: ITables, tableName: keyof ITables, writeManager: any) {
	let sequence = 0;
	const rows = () => tables[tableName];
	const matches = (row: any, where: any): boolean =>
		Object.entries(where ?? {}).every(([field, expected]) => {
			if (expected instanceof FindOperator) {
				if (expected.type === 'not') {
					return String(row[field] ?? '') !== String(expected.value ?? '');
				}

				throw new Error(`the in-memory double does not implement the "${expected.type}" operator`);
			}

			if (expected === undefined) {
				return true;
			}

			return String(row[field] ?? '') === String(expected ?? '');
		});
	const sorted = (found: any[], order?: Record<string, 'ASC' | 'DESC'>) => {
		const columns = Object.keys(order ?? {});

		if (!columns.length) {
			return found;
		}

		return [...found].sort((left, right) => {
			for (const column of columns) {
				if (left[column] === right[column]) {
					continue;
				}

				const direction = order?.[column] === 'DESC' ? -1 : 1;

				return (left[column] > right[column] ? 1 : -1) * direction;
			}

			return 0;
		});
	};

	return {
		rows,
		manager: writeManager,
		metadata: { tableName, hasColumnWithPropertyPath: () => false },
		find: async (options: any = {}) => sorted(rows().filter((row) => matches(row, options.where)), options.order),
		findOne: async (options: any = {}) => {
			const [row] = sorted(rows().filter((candidate) => matches(candidate, options.where)), options.order);

			return row ?? null;
		},
		findOneBy: async (where: any) => rows().find((row) => matches(row, where)) ?? null,
		findAndCount: async (options: any = {}) => {
			const items = rows().filter((row) => matches(row, options.where));

			return [items, items.length];
		},
		count: async () => rows().length,
		create: (partial: any) => ({ ...partial }),
		save: async (entity: any) => {
			if (entity.id) {
				const index = rows().findIndex((row) => row.id === entity.id);

				if (index >= 0) {
					rows()[index] = { ...rows()[index], ...entity };

					return rows()[index];
				}
			}

			const created = { id: `${String(tableName)}-new-${++sequence}`, ...entity };

			rows().push(created);

			return created;
		},
		update: async (criteria: any, partial: any) => {
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = rows().findIndex((row) => row.id === id);

			if (index >= 0) {
				Object.assign(rows()[index], partial);
			}

			return { affected: index >= 0 ? 1 : 0 };
		},
		delete: async (criteria: any) => {
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = rows().findIndex((row) => row.id === id);

			if (index >= 0) {
				rows().splice(index, 1);
			}

			return { affected: index >= 0 ? 1 : 0 };
		}
	};
}

/**
 * Builds the gallery service over one in-memory `product_variant_media` table.
 *
 * @param rows The gallery rows the fixture starts with.
 */
function galleryFixture(rows: any[] = []) {
	const tables: ITables = { product_variant_media: [...rows] };
	const entityToTable = new Map<unknown, keyof ITables>([[ProductVariantMedia, 'product_variant_media']]);
	const writeManager = manager(tables, entityToTable);
	const service = new ProductVariantMediaService(
		repository(tables, 'product_variant_media', writeManager) as never,
		{} as never
	);
	/** The gallery of the fixture variant, in display order. */
	const gallery = (variantId: string = VARIANT) =>
		tables.product_variant_media
			.filter((row) => row.variantId === variantId)
			.sort((left, right) => left.position - right.position);
	const primaries = (variantId: string = VARIANT) =>
		gallery(variantId).filter((row) => row.isPrimary).map((row) => row.imageAssetId);

	return { service, tables, gallery, primaries };
}

describe('ProductVariantMediaService — the gallery and its thumbnail (doc 05 §4.8)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('writes a gallery in the order it was given and marks the thumbnail', async () => {
		const fixture = galleryFixture();

		const written = await fixture.service.replaceMedia(VARIANT, [FRONT, SIDE, DETAIL], SIDE);

		expect(written.map((row) => row.imageAssetId)).toEqual([FRONT, SIDE, DETAIL]);
		expect(written.map((row) => row.position)).toEqual([0, 1, 2]);
		expect(fixture.primaries()).toEqual([SIDE]);
	});

	it('reorders an existing gallery without re-attaching its images', async () => {
		const fixture = galleryFixture();

		await fixture.service.replaceMedia(VARIANT, [FRONT, SIDE, DETAIL], FRONT);
		const ids = fixture.gallery().map((row) => row.id);

		const reordered = await fixture.service.replaceMedia(VARIANT, [DETAIL, FRONT, SIDE], FRONT);

		expect(reordered.map((row) => row.imageAssetId)).toEqual([DETAIL, FRONT, SIDE]);
		expect(reordered.map((row) => row.position)).toEqual([0, 1, 2]);
		// The rows are moved, not replaced: a reorder that rewrote the gallery would lose the instant
		// each image was attached and read as a fresh upload.
		expect(reordered.map((row) => row.id).sort()).toEqual([...ids].sort());
		expect(fixture.tables.product_variant_media).toHaveLength(3);
		expect(fixture.primaries()).toEqual([FRONT]);
	});

	it('refuses an image listed twice in one gallery', async () => {
		const fixture = galleryFixture();

		await expect(fixture.service.replaceMedia(VARIANT, [FRONT, SIDE, FRONT])).rejects.toBeInstanceOf(
			BadRequestException
		);
		expect(fixture.tables.product_variant_media).toEqual([]);
	});

	it('refuses a thumbnail that is not one of the images of the gallery it is writing', async () => {
		const fixture = galleryFixture();

		await expect(
			fixture.service.replaceMedia(VARIANT, [FRONT, SIDE], FOREIGN)
		).rejects.toBeInstanceOf(BadRequestException);
		expect(fixture.tables.product_variant_media).toEqual([]);
	});

	it('promotes one image to be the thumbnail and clears the previous one', async () => {
		const fixture = galleryFixture();

		await fixture.service.replaceMedia(VARIANT, [FRONT, SIDE, DETAIL], FRONT);
		const promoted = await fixture.service.setPrimary(VARIANT, DETAIL);

		expect(promoted.map((row) => row.imageAssetId)).toEqual([FRONT, SIDE, DETAIL]);
		// At most one thumbnail, and it is the one that was asked for: a promotion that set the new
		// primary without clearing the old one would leave two.
		expect(fixture.primaries()).toEqual([DETAIL]);
	});

	it('refuses to promote an image the variant does not carry, and leaves the gallery as it was', async () => {
		// A reorder or a promotion that names an image of another variant is a caller working from a
		// stale gallery. Silently ignoring it would answer `200` to something that did not happen; the
		// refusal is what tells the caller to re-read.
		const fixture = galleryFixture();

		await fixture.service.replaceMedia(VARIANT, [FRONT, SIDE], FRONT);

		await expect(fixture.service.setPrimary(VARIANT, FOREIGN)).rejects.toBeInstanceOf(NotFoundException);
		expect(fixture.gallery().map((row) => row.imageAssetId)).toEqual([FRONT, SIDE]);
		expect(fixture.primaries()).toEqual([FRONT]);

		// The same image on another variant's gallery is still not this variant's image.
		const withOtherVariant = galleryFixture([
			mediaRow('other-row', FOREIGN, 0, { variantId: OTHER_VARIANT })
		]);

		await expect(withOtherVariant.service.setPrimary(VARIANT, FOREIGN)).rejects.toBeInstanceOf(
			NotFoundException
		);
		expect(withOtherVariant.gallery(OTHER_VARIANT)).toHaveLength(1);
	});

	it('promotes the first remaining image when the thumbnail is detached', async () => {
		const fixture = galleryFixture();

		await fixture.service.replaceMedia(VARIANT, [FRONT, SIDE, DETAIL], SIDE);
		await fixture.service.detach(VARIANT, SIDE);

		expect(fixture.gallery().map((row) => row.imageAssetId)).toEqual([FRONT, DETAIL]);
		// The variant still has a thumbnail, and it is the first image of what is left — the property
		// existing screens read.
		expect(fixture.primaries()).toEqual([FRONT]);
	});

	it('leaves the thumbnail alone when an image that is not the thumbnail is detached', async () => {
		// Control for the promotion above: detaching an ordinary image must not move the thumbnail.
		const fixture = galleryFixture();

		await fixture.service.replaceMedia(VARIANT, [FRONT, SIDE, DETAIL], SIDE);
		await fixture.service.detach(VARIANT, DETAIL);

		expect(fixture.gallery().map((row) => row.imageAssetId)).toEqual([FRONT, SIDE]);
		expect(fixture.primaries()).toEqual([SIDE]);
	});

	it('refuses to detach an image the variant does not carry', async () => {
		const fixture = galleryFixture();

		await fixture.service.replaceMedia(VARIANT, [FRONT], FRONT);

		await expect(fixture.service.detach(VARIANT, FOREIGN)).rejects.toBeInstanceOf(NotFoundException);
		expect(fixture.gallery()).toHaveLength(1);
	});

	it('empties the gallery when its last image is detached, without inventing a thumbnail', async () => {
		const fixture = galleryFixture();

		await fixture.service.replaceMedia(VARIANT, [FRONT], FRONT);
		await fixture.service.detach(VARIANT, FRONT);

		expect(fixture.tables.product_variant_media).toEqual([]);
		expect(fixture.primaries()).toEqual([]);
	});

	it('reads the gallery of one variant only, in position order', async () => {
		const fixture = galleryFixture([
			mediaRow('row-later', DETAIL, 2),
			mediaRow('row-first', FRONT, 0),
			mediaRow('row-middle', SIDE, 1),
			mediaRow('row-other-variant', FRONT, 0, { variantId: OTHER_VARIANT }),
			mediaRow('row-other-org', FRONT, 0, { organizationId: OTHER_ORG })
		]);

		const gallery = await fixture.service.findByVariant(VARIANT);

		expect(gallery.map((row) => row.id)).toEqual(['row-first', 'row-middle', 'row-later']);
	});
});
