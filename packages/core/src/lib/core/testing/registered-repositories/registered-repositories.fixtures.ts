import { coreEntities } from '../../entities';

/** An entity class: anything `new` can build, whatever its constructor takes. */
export type EntityClass = abstract new (...args: never[]) => unknown;

/** Core entity classes by class name: `PayrollRun` for the member `typeOrmPayrollRunRepository`. */
const CORE_ENTITIES_BY_NAME: ReadonlyMap<string, EntityClass> = new Map(
	(coreEntities as EntityClass[]).map((entity) => [entity.name, entity])
);

/** `typeOrmPayrollRunRepository` -> `PayrollRun` */
const TYPEORM_REPOSITORY_MEMBER = /^typeOrm(\w+)Repository$/;

/**
 * Wraps a service so that each of its `typeOrm<Entity>Repository` members answers a stub built for that entity.
 *
 * The services that keep a hand-written list of repositories (`RepositoriesService` for export and import,
 * `FactoryResetService` for a reset) build it from forty-odd injected members. With this, the method that builds
 * the list runs exactly as written, without a database or a Nest container, and a spec can assert what the list
 * holds and in which order. Every other member reads through to the service unchanged.
 *
 * @param service - The service, typically `Object.create(TheService.prototype)`.
 * @param stubFor - Builds the stub for one member, from the core entity its name names (`undefined` for a name
 * that is not a core entity) and the entity name itself.
 * @returns The wrapped service. Members written through it land on `service`.
 */
export function withStubTypeOrmRepositories<T extends object>(
	service: T,
	stubFor: (entity: EntityClass | undefined, entityName: string) => unknown
): T {
	const stubs = new Map<string, unknown>();
	return new Proxy(service, {
		get(target, property, receiver) {
			const member = typeof property === 'string' ? TYPEORM_REPOSITORY_MEMBER.exec(property) : null;
			if (!member) {
				return Reflect.get(target, property, receiver);
			}
			// The same stub every time a member is read, so a spec can hold on to it.
			if (!stubs.has(member[0])) {
				stubs.set(member[0], stubFor(CORE_ENTITIES_BY_NAME.get(member[1]), member[1]));
			}
			return stubs.get(member[0]);
		}
	});
}
