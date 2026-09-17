import { HttpStatus, Injectable } from '@nestjs/common';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context/request-context';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ApiException } from '../core/errors/api-exception';
import {
	IProjectionWalkOptions,
	VisibleWithField,
	collectVisibleWithFields,
	lowerFirst,
	projectEntity,
	projectValue
} from './visibility-metadata';

/**
 * The field a visibility decision is about.
 *
 * Supplying it is what lets the platform answer with a message an operator can act on —
 * `Field 'Order.costTotal' is not readable by this caller.` — instead of a bare denial. `resource`
 * is the type name as the schema spells it (`Order`, `OrderLine`); the lower-case resource name a
 * client branches on is derived from it, so the two can never disagree.
 */
export interface IVisibilityField {
	/** The type the field belongs to, as the schema spells it: `Order`. */
	readonly resource?: string;
	/** The property name: `costTotal`. */
	readonly field?: string;
	/** Whether the caller is trying to read the field or to set it. Defaults to reading. */
	readonly mode?: 'read' | 'write';
}

/**
 * Why a field was withheld, in the shape both surfaces report it.
 */
export interface IVisibilityDenial {
	/** The stable code a client branches on. */
	readonly code: ApiErrorCode;
	/** The HTTP status the equivalent REST answer carries. */
	readonly status: number;
	/** The field's owner and name, already lower-cased for the error's details. */
	readonly details: Record<string, unknown>;
	/** The message, naming the field when the caller supplied it. */
	readonly message: string;
}

/** Options of {@link FieldVisibility.guard}. */
export interface IVisibilityGuardOptions extends IVisibilityField {
	/**
	 * Receives the denial instead of having it thrown.
	 *
	 * A GraphQL field resolver needs no hook — it declares the field nullable, so a thrown denial
	 * resolves that field to `null` and appends the typed error, which is the documented response.
	 * The hook exists for a surface that collects denials itself and renders them in one place.
	 */
	readonly onDenied?: (denial: IVisibilityDenial) => void;
}

/**
 * Decides what one caller may see and set, and applies that decision to a response.
 *
 * The service is the single place the platform asks "may this caller see this field". It reads the
 * caller's grants from the request context — the same set the guard chain enforces routes with, so
 * a field gate can never be wider than the route that returned the row — and it applies the
 * decision through a property delete, never a null: a caller that does not hold the permission
 * cannot tell a withheld value from a field the resource does not have.
 *
 * It is used on both surfaces: the REST projection interceptor hands it each row of a response, and
 * a GraphQL field resolver calls {@link guard} around the read of a gated field. Because both go
 * through one declaration on the entity and one predicate, the two surfaces cannot drift.
 */
@Injectable()
export class FieldVisibility {
	/**
	 * Whether the current caller holds a permission.
	 *
	 * The bearer token's claim is asked first, because that is the set the guard chain enforces with
	 * and a field gate must never be wider than its route. A credential that carries the granted set
	 * on the principal rather than in a token — an API key resolved by its own guard — is honoured
	 * through the same declaration, so the same resource renders the same way for a staff caller and
	 * for a machine caller.
	 *
	 * @param permission The permission to test.
	 * @returns True when the caller holds it.
	 */
	public canSee(permission: PermissionsEnum): boolean {
		if (RequestContext.hasPermission(permission)) {
			return true;
		}

		const granted = (RequestContext.currentUser() as { permissions?: PermissionsEnum[] } | null)?.permissions;

		return Array.isArray(granted) && granted.includes(permission);
	}

	/**
	 * The denial a caller that does not hold a permission receives.
	 *
	 * @param permission The permission that was required.
	 * @param field The field the decision is about, when it is known.
	 * @returns The denial, in the shape both surfaces report it.
	 */
	public denialFor(permission: PermissionsEnum, field: IVisibilityField = {}): IVisibilityDenial {
		const mode = field.mode ?? 'read';
		const details: Record<string, unknown> = { requiredPermission: permission };

		if (field.field) {
			details.field = field.field;
		}

		if (field.resource) {
			details.resource = lowerFirst(field.resource);
		}

		const named = field.resource && field.field ? `${field.resource}.${field.field}` : field.field;

		return {
			code: ApiErrorCode.PERMISSION_DENIED,
			status: HttpStatus.FORBIDDEN,
			details,
			message: named
				? `Field '${named}' is not ${mode === 'write' ? 'writable' : 'readable'} by this caller.`
				: `This caller may not ${mode} the requested field.`
		};
	}

	/**
	 * Refuses the request when the caller does not hold a permission.
	 *
	 * It is what the write path uses: a body that carries a gated field is refused here, before the
	 * service runs, so a value the caller may not set is never handed to a handler at all.
	 *
	 * @param permission The permission that is required.
	 * @param field The field the decision is about, when it is known.
	 * @throws ApiException `403 PERMISSION_DENIED` when the caller does not hold it.
	 */
	public assertCanSee(permission: PermissionsEnum, field: IVisibilityField = {}): void {
		if (this.canSee(permission)) {
			return;
		}

		const denial = this.denialFor(permission, field);

		throw new ApiException(denial.status, denial.code, denial.message, denial.details);
	}

	/**
	 * Reads a gated field, or declines to.
	 *
	 * ```ts
	 * @VisibleWith(PermissionsEnum.ORDERS_VIEW_COST)
	 * @Query(() => Decimal, { nullable: true })
	 * public async costTotal(@Parent() order: IOrder) {
	 * 	return this.visibility.guard(PermissionsEnum.ORDERS_VIEW_COST, () => order.costTotal, {
	 * 		resource: 'Order',
	 * 		field: 'costTotal'
	 * 	});
	 * }
	 * ```
	 *
	 * The read is a callback rather than a value so a resolver can keep the field's own loading logic
	 * inside it and so nothing is read — no lazy relation, no secondary query — for a caller that may
	 * not see the result.
	 *
	 * @param permission The permission required to read the field.
	 * @param read Produces the value; only invoked when the caller holds the permission.
	 * @param options The field's owner and name, and an optional denial sink.
	 * @returns The value, or null when the denial was handed to `onDenied`.
	 * @throws ApiException `403 PERMISSION_DENIED` when the caller does not hold the permission and
	 * no denial sink was supplied. A GraphQL field declared nullable resolves to `null` with the
	 * typed error appended, which is the contract's shape for a withheld field.
	 */
	public async guard<T>(
		permission: PermissionsEnum,
		read: () => T | Promise<T>,
		options: IVisibilityGuardOptions = {}
	): Promise<T | null> {
		if (this.canSee(permission)) {
			return read();
		}

		const denial = this.denialFor(permission, options);

		if (options.onDenied) {
			options.onDenied(denial);

			return null;
		}

		throw new ApiException(denial.status, denial.code, denial.message, denial.details);
	}

	/**
	 * Projects one row in place.
	 *
	 * @param entity The row.
	 * @param entityType The row's class; taken from the row itself when it is not given.
	 * @returns The same row, with every gated field the caller may not see removed.
	 */
	public project<T extends object>(entity: T, entityType?: unknown): T {
		projectEntity(entity, collectVisibleWithFields(entityType ?? entity.constructor), (permission) =>
			this.canSee(permission)
		);

		return entity;
	}

	/**
	 * Projects a whole response in place: one row, a list, or a pagination envelope around either.
	 *
	 * @param value The value a handler returned.
	 * @param options Walk options.
	 * @returns The same value, projected.
	 */
	public projectResponse<T>(value: T, options: IProjectionWalkOptions = {}): T {
		return projectValue(value, (permission) => this.canSee(permission), options);
	}

	/**
	 * The gated fields of a class, exposed so a caller can report which field it refused without
	 * re-deriving the set.
	 *
	 * @param entityType The class.
	 * @returns The gated fields.
	 */
	public fieldsOf(entityType: unknown): readonly VisibleWithField[] {
		return collectVisibleWithFields(entityType);
	}
}
