import { CreateDateColumn, DeleteDateColumn, PrimaryGeneratedColumn, RelationId } from 'typeorm';
import { PrimaryKey, Property } from '@mikro-orm/core';
import { SoftDeletable } from 'mikro-orm-soft-delete';
import { ID } from '@gauzy/contracts';
import { MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../../decorators/entity';
import { PersistenceInvariantTenant } from './persistence-invariant-tenant.entity';

/**
 * Standalone fixture entity for the unified persistence-invariant framework (TASK 3): the same
 * SQLite-safe, non-production entity approach as `orm-conformance/orm-conformance-fixture.entity.ts`
 * (real `MultiORMEntity`/`MultiORMColumn` decorators, no `TenantOrganizationBaseEntity`, since its
 * `id` column's `defaultRaw: 'gen_random_uuid()'` is Postgres-only), but shaped to satisfy
 * `TenantAwareCrudService<T extends TenantBaseEntity>`'s generic constraint structurally — every
 * property `TenantBaseEntity`/`BaseEntity` declare is optional, so a lean class carrying just the
 * columns this suite needs (`id`, `tenantId`, `organizationId`, `name`, `deletedAt`, `createdAt`)
 * type-checks as one without actually extending those classes (and their Postgres-only default).
 *
 * This is what lets `persistence-invariant.spec.ts` drive the REAL `TenantAwareCrudService` against
 * a REAL database under EITHER ORM, reusing the exact same tenant-isolation assertions from
 * `../tenant-isolation/tenant-isolation.assertions` that TASK 1 wrote against an in-memory fake.
 */
@SoftDeletable(() => PersistenceInvariantFixture, 'deletedAt', () => new Date())
@MultiORMEntity('persistence_invariant_fixture')
export class PersistenceInvariantFixture {
	@PrimaryKey({ type: 'uuid' })
	@PrimaryGeneratedColumn('uuid')
	id!: ID;

	// `TenantAwareCrudService.findConditionsWithTenantByUser` always merges a `{ tenant: { id } }`
	// where-clause shape alongside the flat `tenantId` (mirroring `TenantBaseEntity.tenant`/`tenantId`)
	// whenever the entity has a `tenantId` column. Two things to know about that shorthand, confirmed
	// against a real SQLite DB while building this fixture (TASK 1's in-memory fake elided both):
	//  1. TypeORM's real query builder throws `EntityPropertyNotFoundError` if `tenant` isn't an actual
	//     relation on the entity — so this fixture needs one, unlike the fake.
	//  2. `{ tenant: { id } }` compiles to a genuine SQL JOIN, not a plain FK-column filter. Pointing it
	//     at `PersistenceInvariantTenant` (seeded once per tenant id by the harness — see
	//     `persistence-invariant.adapter.ts`) gives that JOIN a real row to match, exactly as
	//     production's actual `Tenant` entity does.
	// `@RelationId` keeps this relation from fighting with the explicit `tenantId` column below over
	// the same physical column, exactly as production entities do.
	//
	// IMPORTANT for whoever builds a MikroORM harness for a different entity next: this only stays
	// on one physical column because the harness's `MikroORM.init()` sets
	// `namingStrategy: EntityCaseNamingStrategy` — the same option production's own
	// `packages/config/src/lib/database.ts` sets, and for exactly this reason. Without it, MikroORM's
	// default `UnderscoreNamingStrategy` names `tenant`'s auto join column `tenantId` (explicitly set
	// by `MultiORMManyToOne`'s `mapManyToOneArgsForMikroORM` default, unaffected by naming strategy)
	// but names this plain `@Property()` mirror `tenant_id` (naming-strategized, no explicit
	// override) — two different columns for what TypeORM treats as one, and
	// `findConditionsWithTenantByUser`'s flat `tenantId` filter then fails with
	// "no such column: tenant_id" (confirmed while building this fixture). Since production sets the
	// matching naming strategy, this is a test-harness-configuration pitfall, not a production bug —
	// but it is a real, sharp edge in how `MultiORMColumn`/`MultiORMManyToOne` interact under MikroORM.
	@MultiORMManyToOne(() => PersistenceInvariantTenant, { nullable: true })
	tenant?: PersistenceInvariantTenant;

	@RelationId((it: PersistenceInvariantFixture) => it.tenant)
	@MultiORMColumn({ type: 'varchar', nullable: true, relationId: true })
	tenantId?: ID;

	@MultiORMColumn({ type: 'varchar', nullable: true })
	organizationId?: ID;

	@MultiORMColumn({ type: 'varchar' })
	name!: string;

	@DeleteDateColumn()
	@Property({ nullable: true })
	deletedAt?: Date | null;

	@CreateDateColumn()
	@Property({ onCreate: () => new Date() })
	createdAt?: Date;
}
