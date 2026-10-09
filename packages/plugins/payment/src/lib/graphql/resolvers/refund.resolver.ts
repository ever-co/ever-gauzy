import { Args, Mutation, Parent, Query, ResolveField, Resolver, Subscription } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import {
	deliverPayloadAsIs,
	EventBus,
	FEATURE_GRAPHQL,
	FeatureFlagGuard,
	Idempotent,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	IConnectionPageSelection,
	resolveConnectionWindow,
	tenantScopedEventStream
} from '@gauzy/core';
import { FeatureFlag } from '@gauzy/common';
import { PaymentRefundedEvent, RefundCreatedEvent } from '../../events';
import { RefundService } from '../../refund/refund.service';
import { RefundLineService } from '../../refund-line/refund-line.service';
import { IRefund, IRefundLine } from '../../payment.types';
import { PaymentPermission } from '../../payment.permissions';
import { rejection, toConnection, toOrder } from '../types/connection';
import {
	IApproveRefundGraphInput,
	IApproveRefundPayload,
	ICancelRefundGraphInput,
	ICancelRefundPayload,
	ICreateRefundGraphInput,
	ICreateRefundPayload,
	IRefundConnection,
	IRefundFilter,
	IPaymentSort,
	IRecoverRefundPayload,
	ISoftDeleteRefundPayload,
	IUpdateRefundGraphInput,
	IUpdateRefundPayload,
	REFUND_SORT_FIELDS,
	withoutRange
} from '../types/payment.types';

/**
 * Money given back, over GraphQL.
 *
 * The split between the four mutations is the point, and it mirrors the REST routes exactly.
 * **Creating** records an intention — a row in `PENDING` that can still be refused. **Updating**
 * changes what explains it, never what it is. **Approving** is the act that moves the money: the
 * payment's `refundedAmount` rises, its status is re-derived and the collection follows. **Cancelling**
 * withdraws the intention before anything moved, and writes nothing back because nothing was written.
 *
 * A create that carries `lines` writes the breakdown with the refund, in the same transaction, and the
 * `lines` field resolves whatever the refund paid back through the refund-line service — including the
 * breakdown of a refund written before that was a table.
 *
 * Creating, updating and cancelling carry `REFUNDS_CREATE`; approving carries `REFUNDS_APPROVE`, which
 * is how a refund above an agent's limit becomes somebody else's decision by construction rather than
 * by convention.
 *
 * **The gate is the catalogue's.** `FeatureFlagGuard` is appended to the guard chain this resolver
 * already carried, and the code it reads is `FEATURE_GRAPHQL` — the commerce catalogue's entry for "the
 * GraphQL endpoint and its resolvers, under the same guards and permissions as REST". The code is
 * imported rather than restated because the value has to agree with the catalogue's `code` and nothing
 * checks one string against another: a literal that drifted names a code no catalogue row carries, which
 * the guard resolves as disabled, so every field here would answer `Cannot query field <name>` for every
 * caller with nothing red anywhere. One statement on the class puts every field behind it, and a tenant
 * that switched the capability off is answered the refusal a disabled capability's routes answer with a
 * 404.
 */
@Resolver('Refund')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class RefundResolver {
	constructor(
		private readonly refundService: RefundService,
		private readonly refundLineService: RefundLineService,
		private readonly eventBus?: EventBus
	) {}

	/**
	 * Lists the refunds of the caller's organization.
	 */
	@Permissions(PaymentPermission.REFUNDS_VIEW as PermissionsEnum)
	@Query('refunds')
	async refunds(
		@Args('filter') filter?: IRefundFilter,
		@Args('sort') sort?: IPaymentSort,
		@Args('limit') limit?: number,
		@Args('offset') offset?: number,
		@Args('page', { type: () => Object, nullable: true }) page?: IConnectionPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	): Promise<IRefundConnection> {
		const { skip, take } = resolveConnectionWindow({ ...(page ?? {}), limit, offset });
		const listing = await this.refundService.findRefunds({
			where: withoutRange(filter as Record<string, unknown>),
			order: toOrder(sort, REFUND_SORT_FIELDS),
			skip,
			take,
			...(withDeleted ? { withDeleted: true } : {})
		});

		return toConnection(listing, skip);
	}

	/**
	 * Reads one refund with the governed reason it cites.
	 */
	@Permissions(PaymentPermission.REFUNDS_VIEW as PermissionsEnum)
	@Query('refund')
	async refund(@Args('id') id: ID): Promise<IRefund> {
		return this.refundService.findRefundOrFail(id);
	}

	/**
	 * Records a refund against an order and, when one is named, against the payment it gives back.
	 */
	@Permissions(PaymentPermission.REFUNDS_CREATE as PermissionsEnum)
	// Recording a refund is the same operation on both surfaces, so this mutation requires the retry key
	// the REST route requires, under the same scope.
	@Idempotent({ scope: 'refund.create', required: true, resourceType: 'refund' })
	@Mutation('createRefund')
	async createRefund(@Args('input') input: ICreateRefundGraphInput): Promise<ICreateRefundPayload> {
		try {
			return { refund: await this.refundService.createRefund(input as never), userErrors: [] };
		} catch (error) {
			return { refund: null, ...rejection<IRefund>(error) };
		}
	}

	/**
	 * Changes what explains a pending refund: its governed reason, its note and its metadata.
	 */
	@Permissions(PaymentPermission.REFUNDS_CREATE as PermissionsEnum)
	@Mutation('updateRefund')
	async updateRefund(@Args('input') input: IUpdateRefundGraphInput): Promise<IUpdateRefundPayload> {
		try {
			return { refund: await this.refundService.updateRefund(input.id, input as never), userErrors: [] };
		} catch (error) {
			return { refund: null, ...rejection<IRefund>(error) };
		}
	}

	/**
	 * Approves a pending refund, moving the payment and its collection with it.
	 */
	@Permissions(PaymentPermission.REFUNDS_APPROVE as PermissionsEnum)
	@Mutation('approveRefund')
	async approveRefund(@Args('input') input: IApproveRefundGraphInput): Promise<IApproveRefundPayload> {
		try {
			return { refund: await this.refundService.approveRefund(input.id, input.note), userErrors: [] };
		} catch (error) {
			return { refund: null, ...rejection<IRefund>(error) };
		}
	}

	/**
	 * Cancels a pending refund. Nothing moved, so nothing is written back.
	 */
	@Permissions(PaymentPermission.REFUNDS_CREATE as PermissionsEnum)
	@Mutation('cancelRefund')
	async cancelRefund(@Args('input') input: ICancelRefundGraphInput): Promise<ICancelRefundPayload> {
		try {
			return { refund: await this.refundService.cancelRefund(input.id, input.reason), userErrors: [] };
		} catch (error) {
			return { refund: null, ...rejection<IRefund>(error) };
		}
	}

	/**
	 * Retires a refund row recoverably.
	 *
	 * The route it mirrors is `DELETE /refunds/:id/soft`, inherited from `CrudController` and overridden
	 * by the controller only to state the permission the base declares no metadata for. It is the
	 * recoverable form of the withdrawal `cancelRefund` performs on the money: cancelling is a state a
	 * pending refund moves to, and this is the row itself leaving the reads without losing what it
	 * records — which matters because a settled refund is the explanation of money that really moved.
	 *
	 * The permission is the route's own — `REFUNDS_CREATE`, the grant the create, update and cancel
	 * routes here carry, because withdrawing a refund row is a refund act and never an approval. This
	 * class states no `@Permissions` of its own, so a field that stated none would carry no metadata at
	 * all, and `PermissionGuard` answers `true` to empty metadata.
	 *
	 * @param id The refund to retire.
	 * @returns The payload, carrying the refund as the soft delete left it.
	 */
	@Permissions(PaymentPermission.REFUNDS_CREATE as PermissionsEnum)
	@Mutation('softDeleteRefund')
	async softDeleteRefund(@Args('id') id: ID): Promise<ISoftDeleteRefundPayload> {
		try {
			return { refund: await this.refundService.softRemove(id), userErrors: [] };
		} catch (error) {
			return { refund: null, ...rejection<IRefund>(error) };
		}
	}

	/**
	 * Restores a refund row that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /refunds/:id/recover`, inherited from `CrudController` and overridden
	 * by the controller only to state the permission the base declares no metadata for. The restored row
	 * is part of the refunded figure the payment and its collection are reconciled against again, which
	 * is why it stays `REFUNDS_CREATE` rather than the approve grant — no money moves either way.
	 *
	 * @param id The refund to restore.
	 * @returns The payload, carrying the restored refund.
	 */
	@Permissions(PaymentPermission.REFUNDS_CREATE as PermissionsEnum)
	@Mutation('recoverRefund')
	async recoverRefund(@Args('id') id: ID): Promise<IRecoverRefundPayload> {
		try {
			return { refund: await this.refundService.softRecover(id), userErrors: [] };
		} catch (error) {
			return { refund: null, ...rejection<IRefund>(error) };
		}
	}

	/**
	 * Resolves the lines a refund paid back.
	 *
	 * **The field states the permission its own rows are read under.** This class carries no
	 * `@Permissions` of its own — every root field above states its own — so before this line the field
	 * carried no permission metadata at all, and `PermissionGuard` answers `true` when the metadata is
	 * empty (`permission.guard.ts`, the `isEmpty(permissions)` return). The grant it states is the one
	 * both surfaces already require for these rows: `GET /refunds/:id` carries `REFUNDS_VIEW` and the
	 * refund-line resource's own list route carries `REFUNDS_VIEW` as well, so declaring it here changes
	 * no caller's answer and stops the field from becoming reachable by every authenticated caller the
	 * day a second root field returns a `Refund`.
	 *
	 * @param refund The refund being read.
	 * @returns Its lines, each marked `legacy` when the breakdown came from the metadata array of a
	 * refund written before this package recorded a line as a row.
	 */
	@Permissions(PaymentPermission.REFUNDS_VIEW as PermissionsEnum)
	@ResolveField('lines')
	async lines(@Parent() refund: IRefund): Promise<IRefundLine[]> {
		if (Array.isArray(refund.lines)) {
			return refund.lines;
		}

		return this.refundLineService.findLines(refund.id);
	}

	/**
	 * Streams the refunds of the subscriber's tenant that succeeded — the money has gone back.
	 *
	 * The SDL declared the field and nothing served it. It is the kernel's tenant-scoped stream over the
	 * event the refund service publishes when a refund succeeds: an event of another tenant, or of none, is
	 * dropped against the subscriber captured when the subscription opened, and the refund it names is
	 * re-read through `findRefundOrFail` — the read `GET /refunds/:id` answers with — as the subscriber.
	 *
	 * @param organizationId The organization to narrow the stream to, when one is named.
	 * @returns The refunds that succeeded.
	 */
	@Permissions(PaymentPermission.REFUNDS_VIEW as PermissionsEnum)
	@Subscription('paymentRefunded', { resolve: deliverPayloadAsIs })
	paymentRefunded(@Args('organizationId') organizationId?: ID): AsyncIterableIterator<IRefund> {
		return this.refundStream(PaymentRefundedEvent, organizationId);
	}

	/**
	 * Streams the refunds the subscriber's tenant recorded, while they are still an intention.
	 *
	 * @param organizationId The organization to narrow the stream to, when one is named.
	 * @returns The refunds that were created.
	 */
	@Permissions(PaymentPermission.REFUNDS_VIEW as PermissionsEnum)
	@Subscription('refundCreated', { resolve: deliverPayloadAsIs })
	refundCreated(@Args('organizationId') organizationId?: ID): AsyncIterableIterator<IRefund> {
		return this.refundStream(RefundCreatedEvent, organizationId);
	}

	/**
	 * One refund stream, scoped to the subscriber and narrowed to the organization it named.
	 *
	 * @param type The event the stream carries.
	 * @param organizationId The organization to narrow to, when one is named.
	 * @returns The refunds the events name, re-read as the subscriber.
	 */
	private refundStream<T extends PaymentRefundedEvent | RefundCreatedEvent>(
		type: new (...args: never[]) => T,
		organizationId?: ID
	): AsyncIterableIterator<IRefund> {
		return tenantScopedEventStream<T, IRefund>(this.eventBus.ofType(type), {
			narrow: (event) => !organizationId || event.organizationId === organizationId,
			tenantOf: (event) => event.tenantId,
			organizationOf: (event) => event.organizationId,
			read: (event) => this.refundService.findRefundOrFail(event.refundId)
		});
	}
}
