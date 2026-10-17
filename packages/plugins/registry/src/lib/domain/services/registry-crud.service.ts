import { BaseEntity, CrudService, MultiORM, MultiORMEnum, TenantAwareCrudService, TenantBaseEntity } from '@gauzy/core';

/**
 * The ORM every registry service reads and writes the registry's own tables with: TypeORM, whichever ORM
 * `DB_ORM` names.
 *
 * **What failed.** The registry is written for TypeORM rows. `PluginSubscription` and `PluginCategory` are
 * TypeORM closure-table trees (`@Tree('closure-table')` with `@TreeParent` / `@TreeChildren({ cascade: true })`),
 * which MikroORM does not map at all; and the handlers read a row, call the entity's domain methods on it
 * (`subscription.canBeCancelled()`, `subscription.cancel()`, `pluginTenant.allowUser()`), change its to-many
 * relations as arrays (`subscription.children.filter(...)`, `this.allowedUsers = [...]`) and save it with
 * TypeORM's cascades. Under `DB_ORM=mikro-orm` the CRUD base answered every read with the plain serialized
 * object, which has none of those methods, a MikroORM entity holds `Collection`s where the code expects arrays,
 * and a read naming a tree relation (`relations: ['children', ...]`) was refused outright. Cancelling,
 * downgrading, upgrading, renewing, extending the trial of, deleting and purchasing a subscription, installing a
 * plugin, managing a plugin tenant's users and assigning a subscription's users all failed there.
 *
 * **Why TypeORM is right under MikroORM too.** Both ORMs are initialised in either mode, on the one database
 * (`database.module.ts`), and since d739d81b25 TypeORM's entity metadata is complete under `DB_ORM=mikro-orm`
 * as well — the `MultiORM*` decorators register TypeORM's mapping in both modes — so a TypeORM repository reads
 * and writes these tables fully there, the closure tables and the cascades included, and every row a handler is
 * handed is the entity it was written for. The registry's subscribers are TypeORM subscribers, pushed onto the
 * TypeORM data source in both modes and never handed to MikroORM, so they keep firing for these writes, once.
 *
 * **Under `DB_ORM=typeorm` (production) nothing changes**: the kernel's answer there is TypeORM already.
 *
 * The MikroORM repositories stay injected — the CRUD base takes one — and registered with
 * `MikroOrmModule.forFeature`, but no registry service reaches them while the pin holds: every `this.ormType`
 * switch in the kernel's CRUD base, its tenant scoping, and this package takes its TypeORM arm. Rows of core
 * entities (users, roles, tags) are still read through the core services, on the ORM `DB_ORM` names.
 */
export const REGISTRY_ORM_TYPE: MultiORM = MultiORMEnum.TypeORM;

/**
 * `CrudService`, answering {@link REGISTRY_ORM_TYPE} for its ORM. The base for the registry's services of
 * entities that are not tenant-scoped.
 */
export abstract class RegistryCrudService<T extends BaseEntity> extends CrudService<T> {
	/** Always TypeORM; see {@link REGISTRY_ORM_TYPE}. */
	public override get ormType(): MultiORM {
		return REGISTRY_ORM_TYPE;
	}
}

/**
 * `TenantAwareCrudService`, answering {@link REGISTRY_ORM_TYPE} for its ORM, so its tenant scoping takes the same
 * (TypeORM) arm as the statements it scopes. The base for the registry's tenant-scoped services.
 */
export abstract class RegistryTenantAwareCrudService<T extends TenantBaseEntity> extends TenantAwareCrudService<T> {
	/** Always TypeORM; see {@link REGISTRY_ORM_TYPE}. */
	public override get ormType(): MultiORM {
		return REGISTRY_ORM_TYPE;
	}
}
