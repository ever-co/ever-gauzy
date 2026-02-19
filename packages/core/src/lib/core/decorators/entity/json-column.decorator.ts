/**
 * json-column.decorator.ts
 *
 * Unified JSON column decorator for TypeORM AND MikroORM.
 * ORM-native column options are spread directly into JsonColumnOptions<T>
 * so callers get full autocomplete and type-safety — no `Record<string, unknown>` escape hatch.
 *
 * Environment variables:
 *   ORM_TYPE = 'typeorm' | 'mikro-orm'                           (default: 'typeorm')
 *   DB_TYPE  = 'postgres' | 'mysql' | 'mariadb' | 'sqlite' | …  (default: 'sqlite')
 */

import { ColumnOptions } from './column-options.types';

// ─────────────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────────────

type DbDriver = 'postgres' | 'mysql' | 'mariadb' | 'sqlite' | 'better-sqlite3' | 'mssql' | 'default';

type OrmKind = 'typeorm' | 'mikro-orm';

export type JsonStorageType = 'jsonb' | 'json' | 'simple-json' | 'text';

// ─────────────────────────────────────────────────────────────────────────────
// Option interfaces — native ORM options spread in directly
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options accepted when ORM_TYPE=typeorm.
 * Extends TypeORM's `ColumnOptions` minus the fields we control internally
 * (`type` and `transformer` are managed by the decorator itself).
 */
export type TypeOrmJsonColumnOptions<T> = ColumnOptions<T> & {
	defaultValue?: T;
	forceType?: JsonStorageType;
};

/**
 * Options accepted when ORM_TYPE=mikro-orm.
 * Extends MikroORM's `PropertyOptions` minus the fields we control internally
 * (`type` / `customType` are managed by the decorator itself).
 */
export type MikroOrmJsonColumnOptions<T> = ColumnOptions<T> & {
	defaultValue?: T;
	forceType?: JsonStorageType;
};

/**
 * Union used for the public-facing helpers.
 * In a project that only uses one ORM the compiler will narrow automatically.
 */
export type JsonColumnOptions<T> = TypeOrmJsonColumnOptions<T> | MikroOrmJsonColumnOptions<T>;

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function getDbDriver(): DbDriver {
	return (process.env.DB_TYPE as DbDriver) ?? 'default';
}

function getOrmKind(): OrmKind {
	return (process.env.ORM_TYPE as OrmKind) ?? 'typeorm';
}

function resolveStorageType(db: DbDriver): JsonStorageType {
	switch (db) {
		case 'postgres':
			return 'jsonb';
		case 'mysql':
		case 'mariadb':
			return 'json';
		case 'mssql':
			return 'text';
		case 'sqlite':
		case 'better-sqlite3':
		default:
			return 'simple-json';
	}
}

function safeParse<T>(raw: unknown, fallback: T): T {
	if (raw === null || raw === undefined) return fallback;
	if (typeof raw === 'object') return raw as T;
	if (typeof raw === 'string') {
		try {
			return JSON.parse(raw) as T;
		} catch {
			return fallback;
		}
	}
	return fallback;
}

// ─────────────────────────────────────────────────────────────────────────────
// TypeORM path
// ─────────────────────────────────────────────────────────────────────────────

function buildTypeOrmDecorator<T>(opts: TypeOrmJsonColumnOptions<T>): PropertyDecorator {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const { Column } = require('typeorm') as typeof import('typeorm');

	// Pull out our custom keys; everything else is a native ColumnOption
	const { defaultValue = null as unknown as T, forceType, ...columnOptions } = opts;
	const storageType = forceType ?? resolveStorageType(getDbDriver());

	return Column({
		// Native ColumnOptions spread first so our keys take precedence
		...columnOptions,
		type: storageType as import('typeorm').ColumnType,
		transformer: {
			to(value: T | null | undefined): T | string | null {
				if (value === null || value === undefined) return null;
				if (storageType === 'text') {
					try {
						return JSON.stringify(value);
					} catch {
						return null;
					}
				}

				return value;
			},
			from(value: unknown): T {
				return safeParse<T>(value, defaultValue);
			}
		}
	});
}

// ─────────────────────────────────────────────────────────────────────────────
// MikroORM path
// ─────────────────────────────────────────────────────────────────────────────

function buildMikroOrmDecorator<T>(opts: MikroOrmJsonColumnOptions<T>): PropertyDecorator {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const { Property, Type } = require('@mikro-orm/core') as typeof import('@mikro-orm/core');

	const { defaultValue = null as unknown as T, forceType, ...propertyOptions } = opts;
	const storageType = forceType ?? resolveStorageType(getDbDriver());

	const sqlType = (t: JsonStorageType): string => (t === 'jsonb' ? 'jsonb' : t === 'json' ? 'json' : 'text');

	class JsonType extends Type<T, string | null> {
		convertToDatabaseValue(value: T | null | undefined): string | null {
			if (value === null || value === undefined) return null;
			try {
				return JSON.stringify(value);
			} catch {
				return null;
			}
		}

		convertToJSValue(value: string | object | null | undefined): T {
			return safeParse<T>(value, defaultValue);
		}

		getColumnType(): string {
			return sqlType(storageType);
		}

		// Serialize both sides to JSON string before comparing — prevents
		// every flush from marking every JSON column as dirty.
		compareAsType(): string {
			return 'string';
		}

		toJSON(value: T): T {
			return value;
		}
	}

	return Property({
		// Native PropertyOptions spread first
		...(propertyOptions as Record<string, unknown>),
		type: new JsonType() // instance so JsonType closes over defaultValue
	});
}

// ─────────────────────────────────────────────────────────────────────────────
// Public decorators
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `@JsonColumn<T>(options?)`
 *
 * Unified JSON column for TypeORM and MikroORM
 * All native ORM column options are accepted directly — no wrapper object needed.
 *
 * TypeORM example:
 * ```ts
 * @JsonColumn<Meta>({ defaultValue: { tags: [] }, nullable: true, comment: 'User meta' })
 * meta: Meta;
 * ```
 *
 * MikroORM example:
 * ```ts
 * @JsonColumn<Meta>({ defaultValue: { tags: [] }, nullable: true, comment: 'User meta' })
 * meta: Meta;
 * ```
 */
export function JsonColumn<T = unknown>(options: JsonColumnOptions<T> = {}): PropertyDecorator {
	return getOrmKind() === 'mikro-orm'
		? buildMikroOrmDecorator<T>(options as MikroOrmJsonColumnOptions<T>)
		: buildTypeOrmDecorator<T>(options as TypeOrmJsonColumnOptions<T>);
}

/**
 * `@JsonbColumn<T>(options?)`
 *
 * Forces `jsonb` storage (PostgreSQL).
 * Accepts all native ORM column options directly.
 *
 * ```ts
 * @JsonbColumn<Payload>({ nullable: true })
 * payload: Payload | null;
 * ```
 */
export function JsonbColumn<T = unknown>(options: Omit<JsonColumnOptions<T>, 'forceType'> = {}): PropertyDecorator {
	return JsonColumn<T>({ ...options, forceType: 'jsonb' });
}

/**
 * `@JsonArrayColumn<T>(options?)`
 *
 * JSON column for arrays. Defaults to `[]` — never reads `null`.
 * Accepts all native ORM column options directly.
 *
 * ```ts
 * @JsonArrayColumn<string>({ comment: 'Tag list' })
 * tags: string[];
 * ```
 */
export function JsonArrayColumn<T = unknown>(
	options: Omit<JsonColumnOptions<T[]>, 'defaultValue'> & { defaultValue?: T[] } = {}
): PropertyDecorator {
	return JsonColumn<T[]>({ defaultValue: [], ...options });
}

// ─────────────────────────────────────────────────────────────────────────────
// Usage examples (not executed)
// ─────────────────────────────────────────────────────────────────────────────

/*
interface Address { street: string; city: string; zip: string }
interface Meta    { weight: number; featured: boolean }

// ── TypeORM ──────────────────────────────────────────────────────────────────
import { Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
class ProductTypeOrm {
  @PrimaryGeneratedColumn() id: number;

  // All ColumnOptions available directly — nullable, comment, name, select …
  @JsonColumn<Address>({
    defaultValue: { street: '', city: '', zip: '' },
    nullable: true,
    comment: 'Shipping address',
  })
  address: Address | null;

  @JsonbColumn<Meta>({ defaultValue: { weight: 0, featured: false }, select: false })
  meta: Meta;

  @JsonArrayColumn<string>({ comment: 'Tags', name: 'tag_list' })
  tags: string[];
}

// ── MikroORM─────────────────────────────────────────────────────────
import { Entity, PrimaryKey } from '@mikro-orm/core';

@Entity()
class ProductMikroOrm {
  @PrimaryKey() id: number;

  // All PropertyOptions available directly — nullable, comment, lazy, hidden …
  @JsonColumn<Address>({
    defaultValue: { street: '', city: '', zip: '' },
    nullable: true,
    comment: 'Shipping address',
  })
  address: Address | null;

  @JsonbColumn<Meta>({ defaultValue: { weight: 0, featured: false }, lazy: true })
  meta: Meta;

  @JsonArrayColumn<string>({ comment: 'Tags', fieldName: 'tag_list' })
  tags: string[];
}
*/
