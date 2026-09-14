import { CreateDateColumn, DeleteDateColumn, PrimaryGeneratedColumn } from 'typeorm';
import { PrimaryKey, Property } from '@mikro-orm/core';
import { SoftDeletable } from 'mikro-orm-soft-delete';
import { MultiORMColumn, MultiORMEntity } from '../../decorators/entity';

/**
 * Standalone fixture entity for the TypeORM/MikroORM conformance suite (see `orm-conformance.spec.ts`).
 *
 * Deliberately NOT part of the production schema — it is never passed to a
 * `TypeOrmModule.forFeature`/`MikroOrmModule.forFeature` call, so it never reaches a real
 * database. It exists purely so this suite can drive the REAL production dual-ORM decorators
 * (`MultiORMEntity`, `MultiORMColumn`) against an in-memory SQLite database under each ORM, without
 * inheriting `TenantOrganizationBaseEntity`'s Postgres-only `id` default
 * (`defaultRaw: 'gen_random_uuid()'`, see `core/entities/base.entity.ts`), which SQLite rejects —
 * the same reason `time-tracking/statistic/*.integration.spec.ts` use hand-rolled `EntitySchema`
 * fixtures rather than real entity classes.
 *
 * `@SoftDeletable` mirrors `SoftDeletableBaseEntity`'s usage exactly, so the soft-delete behavior
 * under test (filter-out-by-default, `deletedAt` set on delete) is the real production mechanism,
 * not a reimplementation of it.
 */
@SoftDeletable(
	() => OrmConformanceFixture,
	'deletedAt',
	() => new Date()
)
@MultiORMEntity('orm_conformance_fixture')
export class OrmConformanceFixture {
	@PrimaryKey({ type: 'uuid' })
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@MultiORMColumn({ type: 'varchar' })
	tenantId!: string;

	@MultiORMColumn({ type: 'varchar' })
	organizationId!: string;

	@MultiORMColumn({ type: 'varchar' })
	name!: string;

	@MultiORMColumn({ type: 'int', nullable: true })
	sortOrder?: number;

	@DeleteDateColumn()
	@Property({ nullable: true })
	deletedAt?: Date | null;

	@CreateDateColumn()
	@Property({ onCreate: () => new Date() })
	createdAt?: Date;
}
