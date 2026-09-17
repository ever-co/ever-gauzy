import { PrimaryGeneratedColumn } from 'typeorm';
import { PrimaryKey } from '@mikro-orm/core';
import { ID } from '@gauzy/contracts';
import { MultiORMEntity } from '../../decorators/entity';

/**
 * Minimal relation target for `PersistenceInvariantFixture.tenant`. A real relation-shorthand where
 * clause (`{ tenant: { id } }`, which `TenantAwareCrudService` always merges in) compiles to a real
 * SQL JOIN, not a plain FK-column filter — confirmed by a self-referential relation returning zero
 * rows for every tenant id, since no row of `PersistenceInvariantFixture` itself had that id. A
 * dedicated marker entity — one row per tenant id, upserted by the harness before each fixture row
 * is seeded — gives the JOIN something real to match, exactly as production's `Tenant` entity does.
 */
@MultiORMEntity('persistence_invariant_tenant')
export class PersistenceInvariantTenant {
	@PrimaryKey({ type: 'uuid' })
	@PrimaryGeneratedColumn('uuid')
	id!: ID;
}
