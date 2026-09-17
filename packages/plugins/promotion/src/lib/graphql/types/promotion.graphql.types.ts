import { Observable } from 'rxjs';
import { ID, IPagination, IOperation, DecimalString } from '@gauzy/contracts';
import { ICoupon, IGiftCard, IPromotion } from '../../promotion.types';

/**
 * The TypeScript side of the promotion domain's GraphQL contribution.
 *
 * A resolver is an adapter: the schema declares the shapes and this module is what the adapter is
 * written against, so the resolver files carry no anonymous object literals and a field added to the
 * schema has one place to be typed. The names mirror the SDL — an `I` prefix marks the interface, the
 * payload aliases carry the SDL's own member names — so reading a resolver beside the schema needs no
 * translation.
 *
 * Two functions live here rather than in a file of their own. `toConnection` is the one place a page
 * the services return is turned into the Relay shape the schema declares, and `toAsyncIterable` is
 * the one place an rxjs stream is adapted to the async iterable a subscription has to return; both
 * are the shapes layer's own job, and keeping them here means no resolver carries its own copy of
 * either.
 */

/* ------------------------------------------------------------------------------------------------
 * Pages
 * ---------------------------------------------------------------------------------------------- */

/**
 * The boundary of a page, as the kernel's `PageInfo` declares it.
 *
 * `startCursor` and `endCursor` are opaque: a client echoes them back and never parses them.
 */
export interface IPageInfo {
	readonly hasNextPage: boolean;
	readonly hasPreviousPage: boolean;
	readonly startCursor: string | null;
	readonly endCursor: string | null;
}

/**
 * One row inside a page, with the cursor that points at it.
 */
export interface IEdge<TNode> {
	readonly node: TNode;
	readonly cursor: string;
}

/**
 * One page of rows, in the Relay shape the schema declares.
 */
export interface IConnection<TNode> {
	readonly nodes: TNode[];
	readonly edges: IEdge<TNode>[];
	readonly totalCount: number;
	readonly pageInfo: IPageInfo;
}

/**
 * Turns the page a service returns into the connection the schema declares.
 *
 * A cursor here is the row's offset rendered as a string. That is deliberately the crudest cursor
 * that works: it is what the offset and limit walk the services expose can actually honour, so
 * `after` resumes exactly where the previous page stopped. It stays opaque to the caller — the
 * contract is that a client passes it back, not that it can read it — so a future cursor codec can
 * replace it without a schema change.
 *
 * @param page The page the service returned.
 * @param offset The offset the page was read at, which is what a cursor is derived from.
 * @returns The connection.
 */
export function toConnection<TNode>(page: IPagination<TNode>, offset = 0): IConnection<TNode> {
	const nodes = page?.items ?? [];
	const totalCount = Number(page?.total ?? nodes.length);

	return {
		nodes,
		edges: nodes.map((node, index) => ({ node, cursor: String(offset + index) })),
		totalCount,
		pageInfo: {
			hasNextPage: offset + nodes.length < totalCount,
			hasPreviousPage: offset > 0,
			startCursor: nodes.length > 0 ? String(offset) : null,
			endCursor: nodes.length > 0 ? String(offset + nodes.length - 1) : null
		}
	};
}

/**
 * The cursor window of a list request.
 */
export interface IPageInput {
	readonly first?: number | null;
	readonly after?: string | null;
	readonly last?: number | null;
	readonly before?: string | null;
}

/**
 * The ordering of a list request, as the schema declares it.
 */
export interface ISortInput {
	readonly field?: string | null;
	readonly direction?: string | null;
}

/**
 * The window one list request reads.
 *
 * Both pagination styles reach the services as an offset and a limit, because that is the walk they
 * support: a cursor is the offset it was produced at, and `first` is the same thing as `limit`. The
 * two are merged rather than refused, and the cursor wins where both are present, so a client that
 * walks pages with `first`/`after` and one that asks for `limit`/`offset` see the same rows.
 *
 * @param page The cursor window, when the caller walked one.
 * @param limit The page size, when the caller gave one.
 * @param offset The offset, when the caller gave one.
 * @returns The take and skip the service call receives.
 */
export function toWindow(page?: IPageInput | null, limit?: number | null, offset?: number | null): { take?: number; skip?: number } {
	const take = page?.first ?? limit ?? undefined;
	const skip = offset ?? (page?.after ? Number(page.after) : undefined);

	return {
		...(take ? { take } : {}),
		...(skip ? { skip } : {})
	};
}

/**
 * The offset a request starts reading at.
 *
 * The same figure `toWindow` derives, exposed on its own because the connection that comes back needs
 * it to number its cursors: a cursor is the row's offset, so the mapper has to know where the page
 * began.
 *
 * @param page The cursor window, when the caller walked one.
 * @param offset The offset, when the caller gave one.
 * @returns The offset.
 */
export function cursorOffset(page?: IPageInput | null, offset?: number | null): number {
	return offset ?? (page?.after ? Number(page.after) : 0);
}

/**
 * Turns the schema's sort input into the ordering the services accept.
 *
 * The schema names a sortable field the way a client reads it — `CREATED_AT` — and a service orders by
 * the column it is stored in — `createdAt` — so the mapping is a table each domain declares once,
 * beside its own filters. A field the table does not name orders nothing rather than ordering by
 * something unexpected, and the direction defaults to descending, which is what a list of offers is
 * almost always asked for.
 *
 * @param sort The sort input.
 * @param columns The column each sortable field names.
 * @returns The ordering, or undefined when nothing was asked for.
 */
export function toOrder(
	sort: ISortInput | null | undefined,
	columns: Readonly<Record<string, string>>
): Record<string, 'ASC' | 'DESC'> | undefined {
	const column = sort?.field ? columns[sort.field] : undefined;

	if (!column) {
		return undefined;
	}

	return { [column]: String(sort?.direction ?? 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC' };
}

/* ------------------------------------------------------------------------------------------------
 * Mutation payloads
 * ---------------------------------------------------------------------------------------------- */

/**
 * One expected, caller-correctable outcome of a mutation.
 *
 * The kernel's `UserError` declares this shape and the REST surface returns the same code for the
 * same condition, so a client that already branches on a code does not learn a second vocabulary.
 */
export interface IUserError {
	readonly code: string;
	readonly message: string;
	readonly path?: string[] | null;
	readonly details?: Record<string, unknown> | null;
}

/**
 * What every mutation answers with: the resource it changed, the operation the change belongs to,
 * and the outcomes the caller can act on.
 *
 * A business rejection is reported here on a successful operation — "this code is exhausted" is not
 * a transport failure — and only a request the caller could not have made correctly becomes a
 * GraphQL error. `TKey` is the resource's own member name in the payload, so the alias below reads
 * exactly like the SDL field it answers.
 */
export type IMutationPayload<TKey extends string, TResource> = {
	readonly [P in TKey]?: TResource | null;
} & {
	readonly operation?: IOperation | null;
	readonly userErrors: IUserError[];
};

/** The outcome of creating a promotion. */
export type CreatePromotionPayload = IMutationPayload<'promotion', IPromotion>;
/** The outcome of changing a promotion. */
export type UpdatePromotionPayload = IMutationPayload<'promotion', IPromotion>;
/** The outcome of deleting a promotion. */
export type DeletePromotionPayload = IMutationPayload<'promotion', IPromotion>;
/** The outcome of starting a promotion. */
export type ActivatePromotionPayload = IMutationPayload<'promotion', IPromotion>;
/** The outcome of closing a promotion before its window ends. */
export type ExpirePromotionPayload = IMutationPayload<'promotion', IPromotion>;
/** The outcome of creating a campaign. */
export type CreateCampaignPayload = IMutationPayload<'campaign', unknown>;
/** The outcome of changing a campaign. */
export type UpdateCampaignPayload = IMutationPayload<'campaign', unknown>;
/** The outcome of deleting a campaign. */
export type DeleteCampaignPayload = IMutationPayload<'campaign', unknown>;
/** The outcome of setting a campaign's ceiling. */
export type UpdateCampaignBudgetPayload = IMutationPayload<'budget', unknown>;
/** The outcome of creating a coupon. */
export type CreateCouponPayload = IMutationPayload<'coupon', ICoupon>;
/** The outcome of changing a coupon. */
export type UpdateCouponPayload = IMutationPayload<'coupon', ICoupon>;
/** The outcome of deleting a coupon. */
export type DeleteCouponPayload = IMutationPayload<'coupon', ICoupon>;
/** The outcome of issuing a gift card. */
export type IssueGiftCardPayload = IMutationPayload<'giftCard', IGiftCard>;
/** The outcome of spending part of a card's balance. */
export type RedeemGiftCardPayload = IMutationPayload<'giftCard', IGiftCard> & {
	readonly applied?: DecimalString;
};
/** The outcome of withdrawing a card from circulation. */
export type VoidGiftCardPayload = IMutationPayload<'giftCard', IGiftCard>;

/* ------------------------------------------------------------------------------------------------
 * The writable shapes
 * ---------------------------------------------------------------------------------------------- */

/**
 * One action of a promotion, as it is written.
 */
export interface IPromotionActionInput {
	readonly id?: ID;
	readonly type: string;
	readonly targetType: string;
	readonly allocation?: string;
	readonly value: DecimalString;
	readonly currency?: string;
	readonly maxQuantity?: DecimalString;
	readonly applyToQuantity?: DecimalString;
	readonly buyRulesMinQuantity?: DecimalString;
	readonly isTaxInclusive?: boolean;
	readonly position?: number;
	readonly metadata?: Record<string, unknown>;
}

/** The fields a promotion is created with. */
export interface ICreatePromotionInput {
	readonly code?: string;
	readonly title: string;
	readonly description?: string;
	readonly type?: string;
	readonly status?: string;
	readonly isAutomatic?: boolean;
	readonly isCombinable?: boolean;
	readonly stackingGroup?: string;
	readonly priority?: number;
	readonly campaignId?: ID;
	readonly channelId?: ID;
	readonly currency?: string;
	readonly customerGroupId?: ID;
	readonly startsAt?: Date;
	readonly endsAt?: Date;
	readonly usageLimit?: number;
	readonly perCustomerUsageLimit?: number;
	readonly budgetAmount?: DecimalString;
	readonly isTaxInclusive?: boolean;
	readonly metadata?: Record<string, unknown>;
	readonly actions?: IPromotionActionInput[];
}

/** The fields of a promotion that may be changed. */
export interface IUpdatePromotionInput extends Partial<ICreatePromotionInput> {}

/** The fields a campaign is created with. */
export interface ICreateCampaignInput {
	readonly identifier: string;
	readonly name: string;
	readonly description?: string;
	readonly status?: string;
	readonly startsAt?: Date;
	readonly endsAt?: Date;
	readonly metadata?: Record<string, unknown>;
}

/** The fields of a campaign that may be changed. */
export interface IUpdateCampaignInput extends Partial<ICreateCampaignInput> {}

/** The ceiling to store on a campaign. */
export interface IUpdateCampaignBudgetInput {
	readonly type?: string;
	readonly limit?: DecimalString;
	readonly attribute?: string;
	readonly currency?: string;
}

/** The fields a coupon is created with. */
export interface ICreateCouponInput {
	readonly code: string;
	readonly promotionId?: ID;
	readonly batchId?: string;
	readonly usageLimit?: number;
	readonly perCustomerLimit?: number;
	readonly startsAt?: Date;
	readonly endsAt?: Date;
	readonly metadata?: Record<string, unknown>;
}

/** The fields of a coupon that may be changed. */
export interface IUpdateCouponInput extends Partial<Omit<ICreateCouponInput, 'code'>> {}

/** The fields a gift card is issued with. */
export interface IIssueGiftCardInput {
	readonly code?: string;
	readonly initialAmount: DecimalString;
	readonly currency: string;
	readonly customerId?: ID;
	readonly orderId?: ID;
	readonly expiresAt?: Date;
	readonly metadata?: Record<string, unknown>;
}

/** How much of a card is spent, and against what. */
export interface IRedeemGiftCardInput {
	readonly amount: DecimalString;
	readonly orderId?: ID;
	readonly orderCurrency?: string;
	readonly outstanding?: DecimalString;
}

/** Why a card is being withdrawn. */
export interface IVoidGiftCardInput {
	readonly reason?: string;
}

/** Why a promotion is being closed before its window ends. */
export interface IExpirePromotionInput {
	readonly reason?: string;
}

/* ------------------------------------------------------------------------------------------------
 * Query payloads
 * ---------------------------------------------------------------------------------------------- */

/**
 * The answer to a code presented without applying it.
 */
export interface ICouponValidationPayload {
	readonly valid: boolean;
	readonly coupon?: ICoupon | null;
	readonly reason?: string | null;
	readonly discount?: DecimalString | null;
}

/**
 * The balance of a card, answered from its ledger.
 */
export interface IGiftCardBalancePayload {
	readonly balance: DecimalString;
	readonly currency: string;
	readonly status: string;
}

/* ------------------------------------------------------------------------------------------------
 * Subscription payloads
 * ---------------------------------------------------------------------------------------------- */

/**
 * A promotion was created, activated or expired.
 *
 * The shape mirrors the domain's own `PromotionChangedEvent`: the identity of the fact and the state
 * the promotion moved to, never the row. A subscriber that needs the row reads it through
 * `promotion(id)`, so an event never becomes a second, staler copy of a record that has already moved
 * on by the time it is handled. `id` and `createdAt` are the event's own, inherited from the
 * platform's base event.
 */
export interface IPromotionChangedPayload {
	readonly id: ID;
	readonly createdAt: Date;
	readonly promotionId: ID;
	readonly status: string;
	readonly organizationId: ID;
}

/**
 * A campaign budget reached its ceiling.
 */
export interface IPromotionBudgetExhaustedPayload {
	readonly id: ID;
	readonly createdAt: Date;
	readonly promotionId: ID;
	readonly budgetId: ID;
	readonly limit: DecimalString;
	readonly used: DecimalString;
	readonly organizationId: ID;
}

/**
 * A code was redeemed.
 */
export interface ICouponRedeemedPayload {
	readonly id: ID;
	readonly createdAt: Date;
	readonly couponId: ID;
	readonly code: string;
	readonly amount: DecimalString;
	readonly currency: string;
	readonly orderId?: ID;
	readonly organizationId: ID;
}

/**
 * Stored value was spent with a card.
 */
export interface IGiftCardRedeemedPayload {
	readonly id: ID;
	readonly createdAt: Date;
	readonly giftCardId: ID;
	readonly amount: DecimalString;
	readonly balanceAfter: DecimalString;
	readonly orderId?: ID;
	readonly organizationId: ID;
}

/* ------------------------------------------------------------------------------------------------
 * The stream adapter
 * ---------------------------------------------------------------------------------------------- */

/**
 * Adapts the platform's event stream to the async iterable a GraphQL subscription returns.
 *
 * The platform publishes through an rxjs subject and GraphQL consumes an async iterator, so this is
 * the single bridge between them. Events that arrive while a subscriber is between pulls are
 * buffered rather than dropped — a slow client sees a gap-free stream instead of whatever happened
 * to be next when it asked — and closing the subscription unsubscribes the source, so a client that
 * disconnects stops costing anything.
 *
 * @param source The observable to adapt.
 * @returns An async iterable that yields each value the observable emits.
 */
export function toAsyncIterable<TValue>(source: Observable<TValue>): AsyncIterable<TValue> {
	return {
		[Symbol.asyncIterator](): AsyncIterator<TValue> {
			const buffered: TValue[] = [];
			let waiting: ((result: IteratorResult<TValue>) => void) | null = null;
			let finished = false;

			const settle = (): void => {
				if (waiting) {
					const resolve = waiting;
					waiting = null;
					resolve({ value: undefined as unknown as TValue, done: true });
				}
			};

			const subscription = source.subscribe({
				next: (value: TValue) => {
					if (waiting) {
						const resolve = waiting;
						waiting = null;
						resolve({ value, done: false });
						return;
					}

					buffered.push(value);
				},
				error: () => {
					finished = true;
					settle();
				},
				complete: () => {
					finished = true;
					settle();
				}
			});

			return {
				next: (): Promise<IteratorResult<TValue>> => {
					if (buffered.length > 0) {
						return Promise.resolve({ value: buffered.shift() as TValue, done: false });
					}

					if (finished) {
						return Promise.resolve({ value: undefined as unknown as TValue, done: true });
					}

					return new Promise<IteratorResult<TValue>>((resolve) => {
						waiting = resolve;
					});
				},
				return: (): Promise<IteratorResult<TValue>> => {
					finished = true;
					subscription.unsubscribe();

					return Promise.resolve({ value: undefined as unknown as TValue, done: true });
				}
			};
		}
	};
}
