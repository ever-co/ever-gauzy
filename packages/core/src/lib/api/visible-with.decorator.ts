// The per-property write below needs the metadata store to exist. Importing the polyfill here is
// what makes a decorated class work whatever loaded it — the application, a spec, or a check that
// compiles this module on its own.
import 'reflect-metadata';

import { VISIBLE_WITH_METADATA } from '@gauzy/constants';
import { PermissionsEnum } from '@gauzy/contracts';

/**
 * Declares the permission a caller must hold to read — or to write — one property.
 *
 * The declaration lives on the **property of the entity** (or of the DTO that carries a gated write
 * field), not on a route and not on a controller. That placement is the whole point: a resource is
 * rendered differently for two callers without a second endpoint, without a second controller and
 * without a second schema, and a new DTO that carries the field inherits the gate because it
 * inherits the field.
 *
 * ```ts
 * class OrderLine extends TenantOrganizationBaseEntity {
 * 	@VisibleWith(PermissionsEnum.ORDERS_VIEW_COST)
 * 	costPrice?: number;
 * }
 * ```
 *
 * What the declaration means, on each surface:
 *
 * - **REST, read** — the property is **removed** from the response for a caller without the
 *   permission: the key is absent, never `null`, never zeroed, so nothing about the value can be
 *   inferred. A caller that names the field explicitly in `fields=` is answered
 *   `403 PERMISSION_DENIED` instead, because an explicit ask for a forbidden field is an error
 *   rather than an empty value.
 * - **REST, write** — a body carrying the property without the permission is refused before the
 *   service runs.
 * - **GraphQL** — the field stays in the schema (a schema must not vary by caller) and resolves to
 *   `null` with a typed error, through `FieldVisibility.guard`.
 *
 * It is deliberately **not** a secrecy mechanism. A value that must never leave the server — an API
 * key secret, a stored password hash, an encrypted setting — carries `@Exclude({ toPlainOnly: true
 * })` and keeps it: `@Exclude` is unconditional, while this is permission-driven, and a permission
 * can be granted.
 *
 * @param permission The permission required to see or set the property.
 * @returns A property decorator that records the requirement in the metadata store.
 */
export function VisibleWith(permission: PermissionsEnum): PropertyDecorator {
	return (target: object, propertyKey: string | symbol): void => {
		// Written per property on the prototype, which is where the projection and the write check
		// read it. `SetMetadata` cannot be used here: applied to a property it records the value on
		// the class itself, and a resource with two gated fields would keep only the last one.
		Reflect.defineMetadata(VISIBLE_WITH_METADATA, permission, target, propertyKey);
	};
}
