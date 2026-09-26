/**
 * The worker's module graph, checked against the entities the worker hands to the ORM.
 *
 * **The failure this suite exists for cannot be seen by a list of plugin classes.** The worker was
 * given the order plugin alone; the order module imports the pricing and tax modules; each of those
 * registers repositories for its own tables (`MikroOrmModule.forFeature([...])`); and the entities
 * handed to the ORM are core's plus those of the plugins *listed* in `plugins.ts` — the prerequisites
 * were not listed, so MikroORM had never discovered `PricePreference`, and `em.getRepository` threw
 * while the container was being built. The worker did not boot, on either `DB_ORM`, and the spec that
 * checked the list passed, because every class it asked about was there.
 *
 * So this suite loads the **real** plugins and walks the **real** module graph they import — every
 * module, every dynamic module, every maintenance module a plugin adds behind its queue predicate — and
 * collects each repository a `forFeature` call registers. Every one of them has to name an entity the
 * boot registers: `coreEntities`, and the entities of the listed plugins (`getEntitiesFromPlugins`),
 * which is exactly the set `preBootstrapRegisterEntities` hands to both ORMs. **No database is needed**:
 * the repositories a module will ask for are fixed by its metadata, and the entities the ORM will know
 * are fixed by the plugin list, so the comparison is decided before a connection is ever opened.
 *
 * The check is stricter than MikroORM strictly requires, and deliberately: MikroORM also discovers an
 * entity that a registered one reaches through a relation, but TypeORM does not, and a repository whose
 * entity only one ORM knows is a worker that boots on one `DB_ORM` and fails on the other.
 */
import 'reflect-metadata';
import { DynamicModule, ForwardReference, Type } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';

/** The modules whose `forFeature` registers repositories, and the ORM each belongs to. */
const ORM_FEATURE_MODULES: Readonly<Record<string, string>> = {
	MikroOrmModule: 'MikroORM',
	TypeOrmModule: 'TypeORM'
};

/** One repository a `forFeature` call registers, and the chain of modules that imported it. */
interface IRepositoryRegistration {
	/** The ORM whose container provider it is. */
	orm: string;
	/** The entity class name the provider token names. */
	entity: string;
	/** The modules from the plugin down to the one that called `forFeature`. */
	path: string[];
}

type ModuleNode = Type<unknown> | DynamicModule | Promise<DynamicModule> | ForwardReference | undefined;

/**
 * Every repository the module graph under the given roots registers.
 *
 * Both ORMs' Nest adapters name a repository provider `<EntityClass>Repository` for the default
 * connection, and both keep the entity only inside the provider's factory closure — so the provider
 * token is the one place the entity's name can be read from the module metadata without a connection.
 *
 * @param roots The plugin classes, as the worker registers them.
 * @returns The registrations, in the order the walk met them.
 */
async function repositoryRegistrations(roots: ReadonlyArray<unknown>): Promise<IRepositoryRegistration[]> {
	const seen = new Set<unknown>();
	const found: IRepositoryRegistration[] = [];

	const visit = async (node: ModuleNode, path: string[]): Promise<void> => {
		let resolved: unknown = node;

		// An async dynamic module is a promise of one, and a circular import is a forward reference.
		if (resolved && typeof (resolved as Promise<unknown>).then === 'function') {
			resolved = await resolved;
		}
		if (resolved && typeof (resolved as ForwardReference).forwardRef === 'function') {
			resolved = (resolved as ForwardReference).forwardRef();
		}
		if (!resolved || seen.has(resolved)) {
			return;
		}

		seen.add(resolved);

		const dynamic =
			typeof resolved === 'object' && 'module' in (resolved as object) ? (resolved as DynamicModule) : undefined;
		const moduleClass = (dynamic ? dynamic.module : resolved) as Type<unknown>;
		const name = moduleClass?.name ?? 'anonymous';
		const orm = ORM_FEATURE_MODULES[name];

		if (dynamic && orm) {
			for (const provider of dynamic.providers ?? []) {
				const token = (provider as { provide?: unknown })?.provide;

				if (typeof token === 'string' && token.endsWith('Repository')) {
					found.push({ orm, entity: token.slice(0, -'Repository'.length), path: [...path, name] });
				}
			}

			return;
		}

		const imports: ModuleNode[] = [
			...((Reflect.getMetadata(MODULE_METADATA.IMPORTS, moduleClass) as ModuleNode[] | undefined) ?? []),
			...((dynamic?.imports as ModuleNode[] | undefined) ?? [])
		];

		for (const child of imports) {
			await visit(child, [...path, name]);
		}
	};

	for (const root of roots) {
		await visit(root as ModuleNode, []);
	}

	return found;
}

/**
 * The registrations whose entity the boot never hands to the ORM, one line each.
 *
 * @param registrations What the module graph registers.
 * @param registered The entity class names the boot registers.
 * @returns A readable line per offender — the entity, the ORM and the import chain — so a failure says
 * which plugin is missing rather than only that one is.
 */
function unregistered(registrations: IRepositoryRegistration[], registered: ReadonlySet<string>): string[] {
	return [
		...new Set(
			registrations
				.filter((registration) => !registered.has(registration.entity))
				.map(
					(registration) =>
						`${registration.entity} (${registration.orm}) via ${registration.path.join(' → ')}`
				)
		)
	];
}

describe('worker composition — every repository the hosted modules register names an entity the boot registers', () => {
	let plugins: Array<Type<unknown>>;
	let registeredFor: (list: ReadonlyArray<unknown>) => Set<string>;
	let resolvePluginLoadOrder: (list: Array<Type<unknown>>) => Array<Type<unknown>>;

	beforeAll(async () => {
		// The graph is walked as a production worker builds it: with a queue root, so every maintenance
		// module a plugin imports behind `isSchedulerQueueRootEnabled()` is walked as well. The predicate
		// is read when each plugin file is first evaluated, which is why it is stated before the import —
		// and stated rather than deleted, because a `.env.local` loaded by the configuration package does
		// not override a variable that is already set, and would otherwise switch the root back off.
		process.env.REDIS_ENABLED = 'true';
		process.env.SCHEDULER_QUEUE_ENABLED = 'true';
		process.env.WORKER_QUEUE_ENABLED = 'true';

		const core = await import('@gauzy/core');
		const pluginKit = await import('@gauzy/plugin');

		({ plugins } = (await import('./plugins')) as unknown as { plugins: Array<Type<unknown>> });
		resolvePluginLoadOrder = pluginKit.resolvePluginLoadOrder as never;
		// The same two sources `preBootstrapRegisterEntities` merges before either ORM is configured.
		registeredFor = (list) =>
			new Set(
				[
					...(core.coreEntities as Array<Type<unknown>>),
					...pluginKit.getEntitiesFromPlugins(list as never)
				].map((entity) => entity.name)
			);
	}, 900_000);

	it('hosts a list whose every declared prerequisite is present and ordered first', () => {
		// The resolver refuses a missing prerequisite by throwing, which the import above would have done;
		// resolving the list again is a no-op, which says it is already in dependency order.
		expect(resolvePluginLoadOrder([...plugins]).map((plugin) => plugin.name)).toEqual(
			plugins.map((plugin) => plugin.name)
		);
	});

	it('registers, for both ORMs, every entity the hosted module graph asks a repository for', async () => {
		const registrations = await repositoryRegistrations(plugins);

		// A control: the walk reached the order module's own tables and the prerequisite tables that
		// broke the boot, so an empty offender list below is a real answer and not an empty walk.
		expect(registrations.map((registration) => registration.entity)).toEqual(
			expect.arrayContaining(['Order', 'OrderLine', 'PricePreference', 'ExchangeRate', 'TaxRate'])
		);
		expect(new Set(registrations.map((registration) => registration.orm))).toEqual(
			new Set(['MikroORM', 'TypeORM'])
		);

		expect(unregistered(registrations, registeredFor(plugins))).toEqual([]);
	});

	it('would have refused the list that crashed the boot', async () => {
		// The control that makes the assertion above mean something: the list the worker used to host —
		// the documents hub, the cart and the order, with none of their prerequisites — is walked the same
		// way, and the pricing tables the order module reaches through `PricingModule` are reported.
		const byName = new Map(plugins.map((plugin) => [plugin.name, plugin]));
		const previous = ['DocsPlugin', 'CartPlugin', 'OrderPlugin'].map((name) => byName.get(name));
		const offenders = unregistered(await repositoryRegistrations(previous), registeredFor(previous));

		expect(offenders.some((line) => line.startsWith('PricePreference (MikroORM)'))).toBe(true);
		expect(offenders.some((line) => line.startsWith('ExchangeRate (MikroORM)'))).toBe(true);
		expect(offenders.some((line) => line.startsWith('TaxRate (MikroORM)'))).toBe(true);
	});
});
