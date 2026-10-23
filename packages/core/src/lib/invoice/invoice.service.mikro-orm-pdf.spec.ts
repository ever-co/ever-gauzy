import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * An invoice billed by product renders on MikroORM, and renders what it renders on TypeORM.
 *
 * **The defect.** `InvoiceService.generateInvoicePdf` reads the invoice with its lines and each line's product,
 * and `generateInvoicePdfDefinition` names a product line by the product's name in the invoice's language, which
 * it merges by calling `translate`, the merge `TranslatableBase` declares, on the line's product. On TypeORM that
 * product is a `Product` instance and carries the method. On MikroORM the CRUD base answers the invoice as
 * `wrap(entity).toJSON()` — its data, and its loaded relations', as plain objects without the entities' prototypes
 * — so rendering failed with `product.translate is not a function`: the PDF download (REST and GraphQL) of every
 * invoice billed by product answered an error, and the invoice e-mail, which attaches the same PDF, was never sent.
 *
 * **What is real here.** One better-sqlite3 database whose tables TypeORM created from the platform's own mapping,
 * as the migrations create them; the core entities imported under `DB_ORM=mikro-orm`, so MikroORM maps them as it
 * does in production (eager translations, relation-id mirrors) and is opened with the platform's own
 * `autoJoinRefsForFilters` (`@gauzy/config`); and the real `InvoiceService`, whose read and whose document
 * definition are the platform's, run over each ORM's repository in turn against the same rows. Only what the
 * rendering is handed to is stood in for: the i18n service answers each label's key, and the PDF maker answers the
 * document definition it was given, which is what is compared. The entities are imported in a registry kept open
 * while both ORMs build their metadata and every read runs (see `product.service.mikro-orm-translate.spec.ts`).
 */

const TIMEOUT = 15 * 60 * 1000;

const TENANT = '6d000000-0000-4000-8000-000000000001';
const ORGANIZATION = '6d000000-0000-4000-8000-000000000002';
const CONTACT = '6d000000-0000-4000-8000-000000000003';
/** A product with an English and a German translation. */
const WIDGET = '6d000000-0000-4000-8000-000000000100';
/** A product with an English translation only. */
const BARE = '6d000000-0000-4000-8000-000000000200';
/** An invoice billed by product, with a line for each product. */
const INVOICE = '6d000000-0000-4000-8000-000000000300';

/** The outcome of one rendering: the document definition, or the message it failed with. */
interface IOutcome {
	value?: any;
	error?: string;
}

/** What each ORM rendered. */
interface IRendered {
	/** The invoice in German. */
	german: IOutcome;
	/** The invoice in English. */
	english: IOutcome;
	/** Whether the lines' products the read answered carried `translate` of their own. */
	productsCarryTheMerge?: boolean;
	/** For each merge the rendering performed, whether it ran on a `Product` instance. */
	mergedOnEntities?: boolean[];
}

async function attempt(read: () => Promise<unknown>): Promise<IOutcome> {
	try {
		return { value: await read() };
	} catch (error) {
		return { error: error instanceof Error ? error.message : String(error) };
	}
}

/** The lines of the rendered table, in a stable order: the store answers an invoice's lines in no stated order. */
function linesOf(definition: any): string[][] {
	const table = definition.content.find((block: any) => block && block.table).table;
	const [, ...lines] = table.body;
	return [...lines].sort((a: string[], b: string[]) => a.join('|').localeCompare(b.join('|')));
}

/** The document definition without its table, which {@link linesOf} compares. */
function withoutTable(definition: any): unknown {
	return JSON.parse(
		JSON.stringify({
			...definition,
			content: definition.content.map((block: any) => (block && block.table ? 'the table' : block))
		})
	);
}

async function renderThroughBothOrms(): Promise<{ typeorm: IRendered; mikroorm: IRendered }> {
	const previous = process.env.DB_ORM;
	process.env.DB_ORM = 'mikro-orm';

	const database = join(tmpdir(), `invoice-pdf-${process.pid}-${Date.now()}.sqlite`);
	const rendered: { typeorm?: IRendered; mikroorm?: IRendered } = {};

	try {
		await jest.isolateModulesAsync(async () => {
			const { coreEntities } = require('../core/entities');
			const { DataSource } = require('typeorm');
			const { MikroORM, EntityCaseNamingStrategy } = require('@mikro-orm/core');
			const { BetterSqliteDriver } = require('@mikro-orm/better-sqlite');
			const { SoftDeleteHandler } = require('mikro-orm-soft-delete');
			const { MIKRO_ORM_AUTO_JOIN_REFS_FOR_FILTERS } = require('@gauzy/config');
			const { InvoiceTypeEnum } = require('@gauzy/contracts');
			const { CrudService } = require('../core/crud/crud.service');
			const { RequestContext } = require('../core/context/request-context');
			const { MikroOrmBaseEntityRepository } = require('../core/repository/mikro-orm-base-entity.repository');
			const { MultiORMEnum } = require('../core/utils');
			const { Tenant } = require('../tenant/tenant.entity');
			const { Organization } = require('../organization/organization.entity');
			const { OrganizationContact } = require('../organization-contact/organization-contact.entity');
			const { Product } = require('../product/product.entity');
			const { ProductTranslation } = require('../product/product-translation.entity');
			const { Invoice } = require('./invoice.entity');
			const { InvoiceItem } = require('../invoice-item/invoice-item.entity');
			const { InvoiceService } = require('./invoice.service');

			// The tables as TypeORM creates them from the platform's mapping.
			const dataSource = new DataSource({
				type: 'better-sqlite3',
				database,
				entities: coreEntities,
				synchronize: true,
				migrationsRun: false,
				logging: false
			});
			await dataSource.initialize();

			const orm = await MikroORM.init({
				driver: BetterSqliteDriver,
				dbName: database,
				entities: coreEntities,
				persistOnCreate: true,
				extensions: [SoftDeleteHandler],
				// Join only what a read populates, as the platform's MikroORM does (see `database-helpers.ts`).
				autoJoinRefsForFilters: MIKRO_ORM_AUTO_JOIN_REFS_FOR_FILTERS,
				namingStrategy: EntityCaseNamingStrategy,
				allowGlobalContext: true,
				discovery: { warnWhenNoEntities: false }
			});

			try {
				// The placeholder column of the custom-fields embeddables, which MikroORM selects whenever it joins an
				// employee or a project — and the invoice read joins both. An installation has it from the
				// custom-fields migrations (1713275626299, 1714319484155); `synchronize` does not create it, because
				// TypeORM's embeddable gets it at bootstrap, when the application registers its custom fields.
				for (const table of ['employee', 'organization_project']) {
					await dataSource.query(`ALTER TABLE "${table}" ADD "fix_relational_custom_fields" boolean`);
				}

				// The rows the invoice names are what this suite reads; the rows they name in turn are not, so the store
				// is not asked to enforce them. The tenant is stored, because TypeORM's tenant scope is a join to it.
				await dataSource.query('PRAGMA foreign_keys = OFF');
				const scope = { tenantId: TENANT, organizationId: ORGANIZATION };
				const insert = (entity: unknown, rows: object[]) => dataSource.getRepository(entity).insert(rows);

				await insert(Tenant, [{ id: TENANT, name: 'Invoicing tenant' }]);
				await insert(Organization, [{ id: ORGANIZATION, tenantId: TENANT, name: 'Acme', currency: 'EUR' }]);
				await insert(OrganizationContact, [{ id: CONTACT, ...scope, name: 'Globex' }]);
				await insert(Product, [
					{ id: WIDGET, ...scope, code: 'WIDGET' },
					{ id: BARE, ...scope, code: 'BARE' }
				]);
				await insert(ProductTranslation, [
					{ ...scope, referenceId: WIDGET, languageCode: 'en', name: 'Widget', description: 'A widget' },
					{ ...scope, referenceId: WIDGET, languageCode: 'de', name: 'Dings', description: 'Ein Dings' },
					{ ...scope, referenceId: BARE, languageCode: 'en', name: 'Bare', description: 'Nothing else' }
				]);
				await insert(Invoice, [
					{
						id: INVOICE,
						...scope,
						invoiceNumber: 7,
						// Noon, so the day the document prints is the same wherever the suite runs.
						invoiceDate: new Date('2026-03-02T12:00:00.000Z'),
						dueDate: new Date('2026-04-02T12:00:00.000Z'),
						currency: 'EUR',
						discountValue: 0,
						tax: 19,
						tax2: 0,
						terms: 'Net 30',
						totalValue: 35,
						status: 'DRAFT',
						invoiceType: InvoiceTypeEnum.BY_PRODUCTS,
						fromOrganizationId: ORGANIZATION,
						toContactId: CONTACT
					}
				]);
				await insert(InvoiceItem, [
					{
						...scope,
						invoiceId: INVOICE,
						productId: WIDGET,
						description: 'Widgets',
						price: 10,
						quantity: 2,
						totalValue: 20
					},
					{
						...scope,
						invoiceId: INVOICE,
						productId: BARE,
						description: 'Bare ones',
						price: 15,
						quantity: 1,
						totalValue: 15
					}
				]);

				// The caller: a user of the tenant, as the tenant guard leaves the request context.
				jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ tenantId: TENANT });
				jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
				jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null);
				jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(true);

				const renderAll = async (ormType: string): Promise<IRendered> => {
					const ormTypeSpy = jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(ormType);
					const service = new InvoiceService(
						dataSource.getRepository(Invoice),
						// A fresh context per ORM, so an answer is the store's rather than an earlier read's.
						new MikroOrmBaseEntityRepository(orm.em.fork(), Invoice),
						{} as never,
						{} as never,
						{ generatePdf: async (definition: unknown) => definition } as never,
						{ translate: async (key: string) => key } as never,
						{} as never
					);
					// The merge itself, called through: which objects it ran on is what tells the two paths apart.
					const merge = jest.spyOn(Product.prototype, 'translate');

					try {
						const read = await service.findOneByIdString(INVOICE, { relations: ['invoiceItems.product'] });
						return {
							productsCarryTheMerge: read.invoiceItems.every(
								(line: any) => typeof line.product.translate === 'function'
							),
							german: await attempt(() => service.generateInvoicePdf(INVOICE, 'de')),
							english: await attempt(() => service.generateInvoicePdf(INVOICE, 'en')),
							mergedOnEntities: merge.mock.contexts.map((product: unknown) => product instanceof Product)
						};
					} finally {
						merge.mockRestore();
						ormTypeSpy.mockRestore();
					}
				};

				rendered.typeorm = await renderAll(MultiORMEnum.TypeORM);
				rendered.mikroorm = await renderAll(MultiORMEnum.MikroORM);
			} finally {
				jest.restoreAllMocks();
				await orm.close(true);
				await dataSource.destroy();
			}
		});
	} finally {
		if (previous === undefined) delete process.env.DB_ORM;
		else process.env.DB_ORM = previous;
		for (const file of [database, `${database}-wal`, `${database}-shm`]) {
			rmSync(file, { force: true });
		}
	}

	return rendered as { typeorm: IRendered; mikroorm: IRendered };
}

describe('InvoiceService — an invoice billed by product, rendered on MikroORM', () => {
	let typeorm: IRendered;
	let mikroorm: IRendered;

	beforeAll(async () => {
		({ typeorm, mikroorm } = await renderThroughBothOrms());
	}, TIMEOUT);

	it('reads lines whose products carry no merge of their own on MikroORM, and do on TypeORM', () => {
		// The premise of the defect, stated so the suite fails loudly if it stops holding.
		expect(typeorm.productsCarryTheMerge).toBe(true);
		expect(mikroorm.productsCarryTheMerge).toBe(false);
	});

	it('merges on the entity itself on TypeORM, as it always did, and on the serialized product on MikroORM', () => {
		expect(typeorm.mergedOnEntities).toEqual([true, true, true, true]);
		expect(mikroorm.mergedOnEntities).toEqual([false, false, false, false]);
	});

	it.each(['german', 'english'] as const)('renders the invoice in %s on both ORMs', (language) => {
		expect(typeorm[language].error).toBeUndefined();
		expect(mikroorm[language].error).toBeUndefined();
	});

	it('names each line by its product in the invoice language, as TypeORM does', () => {
		expect(linesOf(mikroorm.german.value)).toEqual(linesOf(typeorm.german.value));
		expect(linesOf(mikroorm.english.value)).toEqual(linesOf(typeorm.english.value));

		expect(linesOf(mikroorm.german.value)).toEqual([
			['Dings', 'Widgets', '2', 'EUR 10', 'EUR 20'],
			// No German translation: the product is named by nothing, on both ORMs, as it always was.
			['undefined', 'Bare ones', '1', 'EUR 15', 'EUR 15']
		]);
		expect(linesOf(mikroorm.english.value)).toEqual([
			['Bare', 'Bare ones', '1', 'EUR 15', 'EUR 15'],
			['Widget', 'Widgets', '2', 'EUR 10', 'EUR 20']
		]);
	});

	it('renders the rest of the document as TypeORM does', () => {
		expect(withoutTable(mikroorm.german.value)).toEqual(withoutTable(typeorm.german.value));
		expect(withoutTable(mikroorm.english.value)).toEqual(withoutTable(typeorm.english.value));
	});
});
