import type { ID } from '@gauzy/contracts';
import { bulkOptionsOf } from '../api/bulk.decorator';
import type { IBulkExecutionOptions } from '../api/bulk-executor.service';
import type { BulkOperationKind, BulkRequest } from '../api/bulk';
import type { IProductTranslationInput } from './product.resolver';

/**
 * The product batch, as the two surfaces declare it.
 *
 * A catalogue import is one request whose answer names every item it could not apply, and the
 * contract that states it is the platform's own (`../api/bulk.ts`): the request, the result and the
 * partial-success semantics are the same for every resource, so a domain declares only what its own
 * items carry and nothing about how a batch is run. This module is that declaration for the product
 * resource — the item, the body, the answer and the keys an item must carry — and it holds no runner
 * of its own, because `BulkExecutor` is the platform's single answer to how a batch is applied.
 *
 * The translation member is the one the create and edit inputs already declare, so the same three
 * members name a translation wherever a product's translations are stated.
 *
 * Alongside them this module states the options a batch runs under, read from that declaration, so
 * both surfaces run the batch the same way from the same source.
 */

/**
 * One item of a product batch: the operation the item performs and the product it performs it on.
 *
 * The item is the product's own write payload with the operation stated on top, which is the shape
 * the platform's contract fixes for every resource: `BulkItemRequest<T>` is `T & { op }`, so a batch
 * carries exactly the members the equivalent single-item request carries and nothing beside them. A
 * member that is absent is a member the item says nothing about, which is a different request from a
 * member stated as empty.
 *
 * `op` is required rather than defaulted. The platform's pre-pass treats an item that states none as
 * an upsert, and a batch that silently created a row for a caller who meant to change one would be
 * worse than a batch that says which item it could not read.
 */
export interface IBulkProductItem {
	/** The operation this item performs. */
	op: BulkOperationKind;
	/** The row the item addresses. Stated by the operations that change or archive a product. */
	id?: ID;
	/** The operator-facing code, unique within the organization. */
	code?: string;
	/** Whether the product may be sold. A disabled product stays readable and cannot be ordered. */
	enabled?: boolean;
	/** A denormalised thumbnail URL, kept for lists that must not join the asset table. */
	imageUrl?: string;
	/** The asset the storefront shows as the product's cover. */
	featuredImageId?: ID;
	/** The operator's classification of the product. */
	productTypeId?: ID;
	/** The merchandising grouping the product belongs to. */
	productCategoryId?: ID;
	/** The facets to attach to the product, named by the identifier the pivot row is written from. */
	tagIds?: ID[];
	/** The product's name and description, one row per language. */
	translations?: IProductTranslationInput[];
}

/**
 * The body `POST /products/bulk` accepts.
 *
 * The two members the endpoint table declares, and no others: the items, each naming its operation
 * and payload, and the flag that says whether the batch is one write or a sequence of them. The
 * route states neither a write mode nor a dry run, so a caller cannot ask for one — an input the
 * resource cannot honour is worse than an absent one.
 */
export interface IBulkProductsRequest extends Pick<BulkRequest<IBulkProductItem>, 'items' | 'atomic'> {}

/**
 * What a caller states to `bulkCreateProducts`.
 *
 * The route's own body plus the retry key. GraphQL has no header that can say which of the mutations
 * in a document a key belongs to, so the key rides beside the input it qualifies — and it is read by
 * the platform's idempotency kernel from exactly there, which is why the kernel's refusal for a key
 * it cannot use is the same answer on both surfaces.
 */
export interface IBulkCreateProductsInput extends IBulkProductsRequest {
	/** The client's retry key for this batch. Optional: the operation honours one and does not demand it. */
	idempotencyKey?: string;
}

/**
 * The keys an item of a given operation must carry.
 *
 * This is the platform default narrowed rather than replaced: an operation that changes or archives a
 * row has always had to name it, and every operation has to say what it does. An item missing either
 * is reported as that item's failure before anything is written, with the member it did not carry.
 *
 * @param op The operation the item declares.
 * @returns The members the item must carry.
 */
export const PRODUCT_BULK_REQUIRED_KEYS = (op: BulkOperationKind): readonly string[] =>
	op === 'update' || op === 'delete' ? ['op', 'id'] : ['op'];

/**
 * One item's outcome, as `BulkProductItemResult` declares it.
 *
 * A batch is answered in one piece, so each entry carries the position the item held in the request
 * and either the row that changed or the failure with the item's own code.
 */
export interface IBulkProductItemResult {
	/** The item's position in the request. */
	index: number;
	/** True when the item applied. */
	ok: boolean;
	/** The row that changed, when the item applied. */
	id?: ID;
	/** The resource that changed, so a mixed batch reads unambiguously. */
	resource?: string;
	/** Why the item did not apply, with the item's own code. */
	error?: {
		code: string;
		message: string;
		path: string[];
		details?: Record<string, unknown>;
	};
}

/**
 * What `bulkCreateProducts` answers.
 *
 * The counts are read from the platform's own batch result rather than accumulated here, so a client
 * can assert `succeeded + failed === total` on either surface.
 */
export interface IBulkCreateProductsPayload {
	/** One entry per request item, in request order. */
	results: IBulkProductItemResult[];
	/** How many items applied. */
	succeeded: number;
	/** How many items did not. */
	failed: number;
	/** How many items the request carried. */
	total: number;
}

/**
 * The options a product batch runs under, read from the route's own declaration.
 *
 * The batch's resource name, cap and permission are declared once, by `@BulkOperation` on the route,
 * and are read from there rather than restated wherever a batch is run: a second copy is a second
 * thing to change, and the copy that is wrong is the one a client sees in an error.
 *
 * **The reading is the platform's**, through `bulkOptionsOf`; what this adds is only the members a
 * declaration cannot carry — the keys every item must state, and the transaction runner, which is a
 * function and so does not belong in decorator metadata. It exists so that the route and the mutation
 * that mirrors it name those in one place instead of twice.
 *
 * @param controller The controller class that owns the route.
 * @param methodName The route's method name.
 * @param extensions What the declaration cannot carry.
 * @returns The executor options.
 * @throws Error when the route carries no declaration, which is a programming mistake rather than a
 * request-level failure.
 */
export function productBulkOptions(
	controller: Function,
	methodName: string,
	extensions: Omit<Partial<IBulkExecutionOptions>, 'resource' | 'cap' | 'permission'> = {}
): IBulkExecutionOptions {
	return bulkOptionsOf(controller, methodName, extensions);
}
