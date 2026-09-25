import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EntityManager, IsNull, Not, Repository, UpdateResult } from 'typeorm';
import { ID, IRuleCreateInput } from '@gauzy/contracts';
import {
	ApiErrorCode,
	ApiException,
	EventBus,
	EventOutboxService,
	IVersionExpectation,
	MultiORMEnum,
	RequestContext,
	RuleService,
	SequenceService,
	TenantAwareCrudService,
	bumpVersion,
	commitVersionedUpdate,
	parseEntityVersion
} from '@gauzy/core';
import { Entitlement } from './entitlement.entity';
import { EntitlementActivation } from '../entitlement-activation/entitlement-activation.entity';
import { EntitlementKey } from '../entitlement-key/entitlement-key.entity';
import {
	ENTITLEMENT_NUMBER_KEY,
	EntitlementActivationStatus,
	EntitlementKind,
	EntitlementStatus
} from '../entitlement.enums';
import {
	EntitlementEventName,
	EntitlementRevocationReason,
	IEntitlementGrantInput,
	IEntitlementGrantResult,
	IEntitlementScope
} from '../entitlement.types';
import { EntitlementChangedEvent, EntitlementRevokedEvent } from '../events/entitlement.events';
import { ENTITLEMENT_RULE_OWNER, toRuleInputs } from '../entitlement-conditions';
import { isDueForExpiry, toWholeQuantity } from '../entitlement-check/entitlement-rules';
import { recountEntitlementOccupancy } from '../entitlement-counts';
import { lockEntitlement } from '../entitlement-lock';
import {
	appendEntitlementEvent,
	entitlementRowsOf,
	mikroOrmEntitlementReader,
	runEntitlementTransaction
} from '../entitlement-persistence';
import { EntitlementActivationService } from '../entitlement-activation/entitlement-activation.service';
import { EntitlementKeyService } from '../entitlement-key/entitlement-key.service';
import { EntitlementConditionDTO } from './dto/entitlement.dto';
import { MikroOrmEntitlementRepository } from './repository/mikro-orm-entitlement.repository';
import { TypeOrmEntitlementRepository } from './repository/type-orm-entitlement.repository';

/** Statuses from which a right may be extended by a renewal. */
const EXTENDABLE_STATUSES: EntitlementStatus[] = [
	EntitlementStatus.PENDING,
	EntitlementStatus.ACTIVE,
	EntitlementStatus.SUSPENDED,
	EntitlementStatus.EXPIRED
];

/** Statuses a right may be suspended from. */
const SUSPENDABLE_STATUSES: EntitlementStatus[] = [EntitlementStatus.PENDING, EntitlementStatus.ACTIVE];

/**
 * The version a write that no caller conditioned on is predicated on.
 *
 * A write that arrives from a route is predicated on what its caller accepted in `If-Match`. A write
 * that arrives from anywhere else — the expiry pass, an event consumer, another service — has no
 * caller to condition it, so it is predicated on the version the row holds when the statement runs.
 * Either way the check and the increment are one statement rather than two.
 */
const ANY_VERSION: IVersionExpectation = { wildcard: true, versions: [] };

/**
 * The right itself: granting it, and the transitions that end or bend it.
 *
 * Everything a right does after it exists is here or in the two services it delegates to, and the
 * shape of every write is the same: open a transaction, lock the right, decide from the state the
 * lock protects, write the transition and the event together. That is what makes the two hard cases
 * of this domain true rather than hopeful — a replayed grant returns the original right instead of
 * creating a second one, and two concurrent activations cannot both take the last seat.
 *
 * The service never reads another package's tables. What grants a right arrives as an event (see
 * `EntitlementGrantConsumer`) or as an operator's request, and what it references — the order, the
 * line, the subscription, the party — is carried as an identifier with a foreign key.
 */
@Injectable()
export class EntitlementService extends TenantAwareCrudService<Entitlement> {
	private readonly logger = new Logger(EntitlementService.name);

	constructor(
		readonly typeOrmEntitlementRepository: TypeOrmEntitlementRepository,
		readonly mikroOrmEntitlementRepository: MikroOrmEntitlementRepository,
		private readonly entitlementActivationService: EntitlementActivationService,
		private readonly entitlementKeyService: EntitlementKeyService,
		private readonly sequenceService: SequenceService,
		private readonly ruleService: RuleService,
		private readonly outbox: EventOutboxService,
		private readonly eventBus: EventBus
	) {
		super(typeOrmEntitlementRepository, mikroOrmEntitlementRepository);
	}

	/**
	 * Writes the fields a caller changed onto a right, under the version that caller read.
	 *
	 * The write is predicated on the caller's version rather than on the one the row happens to hold,
	 * which is what turns a second editor's change to the same right into a refusal instead of a silent
	 * overwrite. The conditions are not part of this write: they are `rule` rows the rule engine owns,
	 * and {@link replaceConditions} replaces them in its own transaction.
	 *
	 * @param id The right.
	 * @param changes The fields to change.
	 * @param expectation The version the caller read the right at.
	 * @returns The changed right, with its activations, its keys and the party it belongs to.
	 */
	public async applyChanges(
		id: ID,
		changes: Record<string, unknown>,
		expectation: IVersionExpectation = ANY_VERSION
	): Promise<Entitlement> {
		await commitVersionedUpdate(this, {
			id,
			expectation,
			// The version is written by the conditional update and never by the caller's payload, so a
			// body that carried one cannot move the row past the version the write was predicated on.
			patch: { ...changes }
		});

		return await this.findOneDetailed(id);
	}

	/**
	 * Grants a right.
	 *
	 * Idempotent on the provenance: a grant replayed from the same order line, subscription or
	 * operator request returns the right the first call created rather than a second one, which is
	 * what makes the grant step of a durable operation safe to re-run. The number is allocated before
	 * the transaction opens, because the numbering series takes its own row lock and a number that is
	 * never used is cheaper than a deadlock between two series.
	 *
	 * @param input What grants the right, and what it carries.
	 * @param scope The tenant and organization the grant belongs to; the request context is the
	 * fallback, so the same method serves an operator and a replayed order event.
	 * @returns The right and whether this call created it.
	 * @throws BadRequestException when the term is impossible or a condition cannot be evaluated.
	 */
	public async grant(input: IEntitlementGrantInput, scope: IEntitlementScope = {}): Promise<IEntitlementGrantResult> {
		const kind = input.kind ?? EntitlementKind.LICENCE;
		const quantity = toWholeQuantity(input.quantity ?? 1) ?? 1;
		const startsAt = input.startsAt ? new Date(input.startsAt) : new Date();
		const endsAt = input.endsAt ? new Date(input.endsAt) : null;
		const gracePeriodDays = toWholeQuantity(input.gracePeriodDays ?? 0) ?? 0;
		const activationLimit = toWholeQuantity(input.activationLimit);

		// A term that ends before it starts is not a term. The check constraint says the same thing in
		// the database, which is the point: the rule is enforced where the row is written, not only
		// where the request was validated.
		if (endsAt && endsAt.getTime() <= startsAt.getTime()) {
			throw new BadRequestException(
				'CHK_entitlement_term_order: the end of the term must be later than its start; omit it for a perpetual right.'
			);
		}

		// Conditions are validated before anything is written, so a rule the evaluator could not trust
		// fails the whole request rather than leaving a right without the conditions it was granted
		// under.
		this.assertConditionsWritable(input.conditions);

		const existing = await this.findExistingGrant(input, kind, scope);

		if (existing) {
			return { entitlement: existing, created: false };
		}

		const number = input.number ?? (await this.allocateNumber(input));
		const tenantId = scope.tenantId ?? RequestContext.currentTenantId();
		const organizationId = scope.organizationId ?? RequestContext.currentOrganizationId();

		const entitlement = await this.transaction(async (manager) => {
			const row = manager.create(Entitlement, {
				customerId: input.customerId ?? null,
				orderId: input.orderId ?? null,
				orderLineId: input.orderLineId ?? null,
				subscriptionId: input.subscriptionId ?? null,
				productId: input.productId ?? null,
				variantId: input.variantId ?? null,
				number,
				kind,
				quantity,
				startsAt,
				endsAt,
				gracePeriodDays,
				activationLimit: activationLimit ?? null,
				activationCount: 0,
				// The row starts at the column's own first revision, stated here rather than left to the
				// database default so that the created right carries its version back to the caller on
				// every dialect — that response is where the next write reads the version it states.
				version: 1,
				// A right granted without a purchase behind it is in force at once unless the caller says
				// otherwise: there is no payment to wait for, so `PENDING` would be a state nothing moves
				// it out of.
				status:
					input.activateImmediately || (!input.orderId && !input.subscriptionId)
						? EntitlementStatus.ACTIVE
						: EntitlementStatus.PENDING,
				metadata: (input.metadata as any) ?? null,
				...(tenantId ? { tenantId } : {}),
				...(organizationId ? { organizationId } : {})
			} as Partial<Entitlement>);

			const saved = await manager.save(Entitlement, row);

			await appendEntitlementEvent(this.outbox, manager, {
				name: EntitlementEventName.CREATED,
				aggregateType: 'ENTITLEMENT',
				aggregateId: saved.id as ID,
				data: {
					entitlementId: saved.id,
					customerId: saved.customerId ?? null,
					orderId: saved.orderId ?? null,
					orderLineId: saved.orderLineId ?? null,
					subscriptionId: saved.subscriptionId ?? null,
					kind: saved.kind,
					quantity: saved.quantity,
					startsAt: saved.startsAt,
					endsAt: saved.endsAt ?? null,
					status: saved.status,
					number: saved.number
				},
				tenantId,
				organizationId
			});

			return saved;
		});

		// The rule set is written after the right exists, in the rule engine's own transaction: the
		// rules are rows in a kernel table that this package does not own, and the only thing that has
		// to be atomic with the grant is the grant and its event.
		if (input.conditions?.length) {
			await this.replaceConditions(entitlement.id, input.conditions, scope);
		}

		let issued: { key: EntitlementKey; plaintext: string } | null = null;

		if (input.issueKey) {
			try {
				issued = await this.entitlementKeyService.issue(
					{
						entitlementId: entitlement.id,
						format: input.keyFormat,
						assignedToEmail: input.assignedToEmail
					},
					scope
				);
			} catch (error) {
				// A key that cannot be issued does not undo the right: the right was granted, and an
				// operator can issue the credential afterwards. The failure is reported rather than
				// swallowed, so the caller knows the key is not on its way.
				this.logger.error(
					`The entitlement ${entitlement.id} was granted but its key could not be issued: ${(error as Error)?.message}`
				);
			}
		}

		await this.eventBus.publish(EntitlementChangedEvent.from(entitlement));

		return {
			entitlement,
			created: true,
			key: issued?.key,
			plaintextKey: issued?.plaintext
		};
	}

	/**
	 * Puts the rights a purchase granted into force.
	 *
	 * This is what the payment, order-completion and subscription events call: a right is granted
	 * `PENDING` by the order that sold it and becomes exercisable when the money settles, so the
	 * transition is one update per right and one event that says so. No seat is taken here — a right
	 * being in force is not a device using it — which is why no activation row is written and the
	 * event carries a null activation id.
	 *
	 * Idempotent: a right that is already `ACTIVE` is skipped rather than re-announced, so a replayed
	 * event changes nothing and emits nothing.
	 *
	 * A right whose term ran out while the money was settling is not put into force and does not wait
	 * for the sweep either: it lapses here, through the one expiry write, so a late settlement leaves a
	 * right that is `EXPIRED` with its event emitted, its keys withdrawn and its activations closed
	 * rather than a row that only looks closed.
	 *
	 * @param filter Which rights to put into force: the order they came from, or the subscription.
	 * @param scope The tenant and organization the event belongs to.
	 * @returns The ids of the rights that were put into force.
	 */
	public async activateGranted(
		filter: { orderId?: ID; subscriptionId?: ID },
		scope: IEntitlementScope = {}
	): Promise<ID[]> {
		if (!filter.orderId && !filter.subscriptionId) {
			return [];
		}

		const tenantId = scope.tenantId ?? RequestContext.currentTenantId();
		const organizationId = scope.organizationId ?? RequestContext.currentOrganizationId();
		const now = new Date();

		const activated = await this.transaction(async (manager) => {
			const pending = await manager.find(Entitlement, {
				where: {
					status: EntitlementStatus.PENDING,
					...(filter.orderId ? { orderId: filter.orderId } : { subscriptionId: filter.subscriptionId }),
					...(tenantId ? { tenantId } : {}),
					...(organizationId ? { organizationId } : {})
				} as any
			});

			const ids: ID[] = [];
			const lapsed: ID[] = [];

			for (const entitlement of pending) {
				// A right whose term already ran out is expired rather than activated: a payment that
				// settles late must not create a period nobody paid for. It lapses the way every other
				// lapse does — through the one expiry write — because a right that ends here ends with the
				// same status, the same event and the same withdrawn credentials as one the sweep reaches.
				if (isDueForExpiry({ ...entitlement, status: EntitlementStatus.ACTIVE }, now)) {
					await this.applyExpiry(manager, entitlement, 'TERM_ENDED', now);
					lapsed.push(entitlement.id);
					continue;
				}

				// The right is put into force under the version the read above found — no caller
				// conditioned this write, so the version the row holds is what it is predicated on.
				await this.updateVersionedRow(manager, entitlement, { status: EntitlementStatus.ACTIVE });

				await appendEntitlementEvent(this.outbox, manager, {
					name: EntitlementEventName.ACTIVATED,
					aggregateType: 'ENTITLEMENT',
					aggregateId: entitlement.id as ID,
					data: {
						entitlementId: entitlement.id,
						// No activation row: the right became exercisable, no device took a seat.
						activationId: null,
						customerId: entitlement.customerId ?? null,
						kind: entitlement.kind,
						quantity: entitlement.quantity,
						activatedAt: now,
						orderId: entitlement.orderId ?? null,
						subscriptionId: entitlement.subscriptionId ?? null
					},
					tenantId: entitlement.tenantId,
					organizationId: entitlement.organizationId
				});

				ids.push(entitlement.id);
			}

			return { ids, lapsed };
		});

		for (const id of [...activated.ids, ...activated.lapsed]) {
			const entitlement = await this.findOneScoped(id, scope);

			await this.eventBus.publish(EntitlementChangedEvent.from(entitlement));
		}

		return activated.ids;
	}

	/**
	 * Suspends a right temporarily: a failed renewal, a dispute, an operator pause.
	 *
	 * The activations are deliberately retained. A suspended right is one that is expected to come
	 * back, so the devices keep their slots and are simply refused at use — releasing them would make
	 * a customer re-activate every machine after a payment hiccup.
	 *
	 * @param id The right to suspend.
	 * @param reason Why, kept on the row and carried by the event.
	 * @param scope The tenant and organization the write is scoped to.
	 * @param expectation The version the caller read the right at, when the call has a caller.
	 * @returns The suspended right.
	 * @throws BadRequestException when the right is withdrawn or already expired.
	 */
	public async suspend(
		id: ID,
		reason?: string,
		scope: IEntitlementScope = {},
		expectation: IVersionExpectation = ANY_VERSION
	): Promise<Entitlement> {
		return await this.transaction(async (manager) => {
			const entitlement = await this.requireLocked(manager, id, scope);

			if (entitlement.status === EntitlementStatus.SUSPENDED) {
				return entitlement;
			}

			if (!SUSPENDABLE_STATUSES.includes(entitlement.status)) {
				throw new BadRequestException(
					`A right in status "${entitlement.status}" cannot be suspended; expected ${SUSPENDABLE_STATUSES.join(' or ')}.`
				);
			}

			// The suspension is predicated on the locked row's version; see `updateVersionedRow` for why
			// the transaction-scoped writes state their own predicate rather than calling the helper.
			await this.updateVersionedRow(
				manager,
				entitlement,
				{ status: EntitlementStatus.SUSPENDED, suspendedReason: reason ?? null },
				expectation
			);

			await appendEntitlementEvent(this.outbox, manager, {
				name: EntitlementEventName.SUSPENDED,
				aggregateType: 'ENTITLEMENT',
				aggregateId: entitlement.id as ID,
				data: {
					entitlementId: entitlement.id,
					customerId: entitlement.customerId ?? null,
					suspendedReason: reason ?? null,
					suspendedAt: new Date()
				},
				tenantId: entitlement.tenantId,
				organizationId: entitlement.organizationId
			});

			return (await manager.findOne(Entitlement, { where: { id } as any })) as Entitlement;
		});
	}

	/**
	 * Returns a suspended right to force.
	 *
	 * A right whose term has run out while it was suspended is expired rather than resumed: resuming
	 * it would put a customer back in force for a period nobody paid for, and the grace period is what
	 * expresses "still in force while a renewal is chased".
	 *
	 * @param id The right to resume.
	 * @param scope The tenant and organization the write is scoped to.
	 * @param expectation The version the caller read the right at, when the call has a caller.
	 * @returns The resumed — or expired — right.
	 * @throws BadRequestException when the right is not suspended.
	 */
	public async resume(
		id: ID,
		scope: IEntitlementScope = {},
		expectation: IVersionExpectation = ANY_VERSION
	): Promise<Entitlement> {
		const entitlement = await this.findOneScoped(id, scope);

		if (entitlement.status === EntitlementStatus.ACTIVE) {
			return entitlement;
		}

		if (entitlement.status !== EntitlementStatus.SUSPENDED) {
			throw new BadRequestException(
				`A right in status "${entitlement.status}" cannot be resumed; only a SUSPENDED right can.`
			);
		}

		if (isDueForExpiry(entitlement, new Date())) {
			return await this.expire(id, 'TERM_ENDED', scope, expectation);
		}

		return await this.transaction(async (manager) => {
			// The row was read before the transaction opened, so the statement's own predicate is what
			// makes this write safe: a right that moved on since that read matches no row, and the write
			// is refused rather than applied underneath the change that moved it.
			await this.updateVersionedRow(
				manager,
				entitlement,
				{ status: EntitlementStatus.ACTIVE, suspendedReason: null },
				expectation
			);

			const resumed = (await manager.findOne(Entitlement, { where: { id } as any })) as Entitlement;

			await this.eventBus.publish(EntitlementChangedEvent.from(resumed));

			return resumed;
		});
	}

	/**
	 * Extends a term, which is what a successful subscription billing cycle does.
	 *
	 * Renewal is not a second mechanism: the same row is extended and returned to `ACTIVE` if it was
	 * suspended, so a customer's history stays one right with one number rather than a chain of rows
	 * nobody can follow.
	 *
	 * @param id The right to extend.
	 * @param input The new end of the term and the quantity that was billed.
	 * @param scope The tenant and organization the write is scoped to.
	 * @param expectation The version the caller read the right at, when the call has a caller.
	 * @returns The extended right.
	 * @throws BadRequestException when the right is withdrawn or the new term is not an extension.
	 */
	public async extend(
		id: ID,
		input: { endsAt: Date; quantity?: number; note?: string },
		scope: IEntitlementScope = {},
		expectation: IVersionExpectation = ANY_VERSION
	): Promise<Entitlement> {
		const endsAt = new Date(input.endsAt);

		if (Number.isNaN(endsAt.getTime())) {
			throw new BadRequestException('An extension must state the instant the term now ends at.');
		}

		return await this.transaction(async (manager) => {
			const entitlement = await this.requireLocked(manager, id, scope);

			if (!EXTENDABLE_STATUSES.includes(entitlement.status)) {
				throw new BadRequestException(
					`A right in status "${entitlement.status}" cannot be extended; issue a new right instead.`
				);
			}

			if (entitlement.endsAt && endsAt.getTime() <= new Date(entitlement.endsAt).getTime()) {
				throw new BadRequestException(
					'An extension must move the end of the term forward; the stated instant is not later than the current one.'
				);
			}

			const quantity = input.quantity === undefined ? Number(entitlement.quantity) : toWholeQuantity(input.quantity);

			// The extension is predicated on the locked row's version; see `updateVersionedRow`.
			await this.updateVersionedRow(
				manager,
				entitlement,
				{
					endsAt,
					quantity,
					status: EntitlementStatus.ACTIVE,
					suspendedReason: null
				},
				expectation
			);

			await appendEntitlementEvent(this.outbox, manager, {
				name: EntitlementEventName.RENEWED,
				aggregateType: 'ENTITLEMENT',
				aggregateId: entitlement.id as ID,
				data: {
					entitlementId: entitlement.id,
					subscriptionId: entitlement.subscriptionId ?? null,
					periodEnd: endsAt,
					endsAt,
					quantity,
					note: input.note ?? null
				},
				tenantId: entitlement.tenantId,
				organizationId: entitlement.organizationId
			});

			const extended = (await manager.findOne(Entitlement, { where: { id } as any })) as Entitlement;

			await this.eventBus.publish(EntitlementChangedEvent.from(extended));

			return extended;
		});
	}

	/**
	 * Lowers the ceiling a right carries.
	 *
	 * What a partial refund or a quantity decrease does, and the reason it is not a revocation: the
	 * customer paid for less than they were granted, not for nothing. The surplus activations are
	 * revoked newest-first — the seats taken longest ago are the ones a customer is likeliest to still
	 * be using — and a right reduced to zero is revoked outright, because a right that permits nothing
	 * is not a right.
	 *
	 * @param id The right to reduce.
	 * @param quantity The ceiling that remains.
	 * @param reason Why.
	 * @param scope The tenant and organization the write is scoped to.
	 * @param expectation The version the caller read the right at, when the call has a caller.
	 * @returns The reduced, or revoked, right.
	 * @throws BadRequestException when the quantity is not a reduction.
	 */
	public async reduce(
		id: ID,
		quantity: number,
		reason?: string,
		scope: IEntitlementScope = {},
		expectation: IVersionExpectation = ANY_VERSION
	): Promise<Entitlement> {
		const next = toWholeQuantity(quantity);

		if (next === 0) {
			return await this.revoke(id, reason ?? EntitlementRevocationReason.REFUNDED, scope, expectation);
		}

		return await this.transaction(async (manager) => {
			const entitlement = await this.requireLocked(manager, id, scope);

			if (next >= Number(entitlement.quantity)) {
				throw new BadRequestException(
					'A reduction must lower the quantity; raise it by extending the right instead.'
				);
			}

			// The surplus seats are given up before the ceiling moves, so the count never reads above
			// the limit the row states, not even for the instant between the two writes.
			const live = await manager.find(EntitlementActivation, {
				where: { entitlementId: id, status: EntitlementActivationStatus.ACTIVE } as any,
				order: { activatedAt: 'DESC' } as any
			});
			const surplus = live.slice(next);
			const now = new Date();

			for (const activation of surplus) {
				await manager.update(
					EntitlementActivation,
					{ id: activation.id } as any,
					{
						status: EntitlementActivationStatus.REVOKED,
						revokedAt: now,
						revocationReason: reason ?? 'QUANTITY_REDUCED'
					} as any
				);
			}

			await this.updateVersionedRow(manager, entitlement, { quantity: next }, expectation);

			const liveAfter = await recountEntitlementOccupancy(manager, id);

			await appendEntitlementEvent(this.outbox, manager, {
				name: EntitlementEventName.REDUCED,
				aggregateType: 'ENTITLEMENT',
				aggregateId: entitlement.id as ID,
				data: {
					entitlementId: entitlement.id,
					quantityBefore: entitlement.quantity,
					quantity: next,
					reason: reason ?? null,
					revokedActivationIds: surplus.map((activation) => activation.id),
					liveActivations: liveAfter
				},
				tenantId: entitlement.tenantId,
				organizationId: entitlement.organizationId
			});

			const reduced = (await manager.findOne(Entitlement, { where: { id } as any })) as Entitlement;

			await this.eventBus.publish(EntitlementChangedEvent.from(reduced));

			return reduced;
		});
	}

	/**
	 * Withdraws a right, terminally.
	 *
	 * One transaction does all four things the withdrawal means: the right becomes `REVOKED`, its
	 * keys are withdrawn, its live activations are closed, and the counters are re-derived from the
	 * rows that remain. Nothing is deleted — a revoked right is what the customer was once entitled
	 * to, and a licence audit has to be able to read it.
	 *
	 * A replayed revocation is a no-op rather than a second event, which is what lets an operator
	 * re-run a revocation that half-finished.
	 *
	 * @param id The right to withdraw.
	 * @param reason `REFUNDED`, `CHARGEBACK`, `RETURNED`, `DATA_ERASURE`, or an operator's note.
	 * @param scope The tenant and organization the write is scoped to.
	 * @param expectation The version the caller read the right at, when the call has a caller.
	 * @returns The withdrawn right.
	 * @throws NotFoundException when it is not the caller's.
	 */
	public async revoke(
		id: ID,
		reason: string,
		scope: IEntitlementScope = {},
		expectation: IVersionExpectation = ANY_VERSION
	): Promise<Entitlement> {
		const now = new Date();
		const userId = RequestContext.currentUserId();

		const outcome = await this.transaction(async (manager) => {
			const entitlement = await this.requireLocked(manager, id, scope);

			if (entitlement.status === EntitlementStatus.REVOKED) {
				return { entitlement, activationIds: [] as ID[], alreadyRevoked: true };
			}

			const activationIds = await this.entitlementActivationService.closeAllForEntitlement(
				manager,
				entitlement.id,
				EntitlementActivationStatus.REVOKED,
				reason
			);

			await this.entitlementKeyService.revokeForEntitlement(manager, entitlement.id, reason);

			// The withdrawal is predicated on the locked row's version; see `updateVersionedRow`.
			await this.updateVersionedRow(
				manager,
				entitlement,
				{
					status: EntitlementStatus.REVOKED,
					revokedAt: now,
					revokedReason: reason,
					...(userId ? { revokedByUserId: userId } : {})
				},
				expectation
			);

			await recountEntitlementOccupancy(manager, entitlement.id);

			await appendEntitlementEvent(this.outbox, manager, {
				name: EntitlementEventName.REVOKED,
				aggregateType: 'ENTITLEMENT',
				aggregateId: entitlement.id as ID,
				data: {
					entitlementId: entitlement.id,
					customerId: entitlement.customerId ?? null,
					revokedReason: reason,
					revokedAt: now,
					activationIds
				},
				tenantId: entitlement.tenantId,
				organizationId: entitlement.organizationId
			});

			const revoked = (await manager.findOne(Entitlement, { where: { id: entitlement.id } as any })) as Entitlement;

			return { entitlement: revoked, activationIds, alreadyRevoked: false };
		});

		if (!outcome.alreadyRevoked) {
			await this.eventBus.publish(EntitlementRevokedEvent.from(outcome.entitlement));
		}

		return outcome.entitlement;
	}

	/**
	 * Expires a right whose term and grace period have run out.
	 *
	 * Terminal in the same way a revocation is, and deliberately a different status: an expiry is what
	 * a customer who stopped paying gets, and the difference between "we took it away" and "it lapsed"
	 * is the whole reason both values exist. Keys are withdrawn with it — a credential that outlived
	 * the right it was issued against is a credential that opens nothing.
	 *
	 * @param id The right to expire.
	 * @param reason Why it lapsed.
	 * @param scope The tenant and organization the write is scoped to.
	 * @param expectation The version the caller read the right at, when the call has a caller: a right
	 * resumed past its term lapses under the version the resume was based on.
	 * @returns The expired right.
	 * @throws NotFoundException when it is not the caller's.
	 */
	public async expire(
		id: ID,
		reason = 'TERM_ENDED',
		scope: IEntitlementScope = {},
		expectation: IVersionExpectation = ANY_VERSION
	): Promise<Entitlement> {
		const now = new Date();

		const outcome = await this.transaction(async (manager) => {
			const entitlement = await this.requireLocked(manager, id, scope);

			if (entitlement.status === EntitlementStatus.EXPIRED || entitlement.status === EntitlementStatus.REVOKED) {
				return { entitlement, alreadyClosed: true };
			}

			await this.applyExpiry(manager, entitlement, reason, now, expectation);

			return {
				entitlement: (await manager.findOne(Entitlement, { where: { id: entitlement.id } as any })) as Entitlement,
				alreadyClosed: false
			};
		});

		if (!outcome.alreadyClosed) {
			await this.eventBus.publish(EntitlementChangedEvent.from(outcome.entitlement));
		}

		return outcome.entitlement;
	}

	/**
	 * Writes one lapse, in the caller's transaction.
	 *
	 * Everything a lapse means is written here and nowhere else: the right becomes `EXPIRED`, its
	 * activations are closed, its keys are withdrawn, the counters are re-derived from the rows that
	 * remain, and one `entitlement.expired` row is appended to the outbox. Every path that ends a right
	 * by lapse comes through it — the expiry sweep and an operator's own expiry, and a settlement that
	 * arrives after the term has run out — so "it lapsed" means the same three things wherever it
	 * happens, and a credential can never outlive the right it was issued against (§19.3).
	 *
	 * Taking the caller's manager rather than opening a transaction is what keeps the lapse one
	 * transaction with whatever else the caller is writing, and it is why the closing writes are issued
	 * through the two child services rather than through their own terminal operations.
	 *
	 * @param manager The caller's transaction manager.
	 * @param entitlement The right that lapsed.
	 * @param reason Why it lapsed.
	 * @param now The instant of the lapse.
	 * @param expectation The version the caller accepted, when the lapse has a caller.
	 * @returns Nothing.
	 */
	private async applyExpiry(
		manager: EntityManager,
		entitlement: Entitlement,
		reason: string,
		now: Date,
		expectation: IVersionExpectation = ANY_VERSION
	): Promise<void> {
		await this.entitlementActivationService.closeAllForEntitlement(
			manager,
			entitlement.id,
			EntitlementActivationStatus.EXPIRED,
			reason
		);

		await this.entitlementKeyService.revokeForEntitlement(manager, entitlement.id, reason);

		// The lapse is predicated on the version the right was read at; see `updateVersionedRow`.
		await this.updateVersionedRow(manager, entitlement, { status: EntitlementStatus.EXPIRED }, expectation);

		await recountEntitlementOccupancy(manager, entitlement.id);

		await appendEntitlementEvent(this.outbox, manager, {
			name: EntitlementEventName.EXPIRED,
			aggregateType: 'ENTITLEMENT',
			aggregateId: entitlement.id as ID,
			data: {
				entitlementId: entitlement.id,
				customerId: entitlement.customerId ?? null,
				expiredAt: now,
				reason
			},
			tenantId: entitlement.tenantId,
			organizationId: entitlement.organizationId
		});
	}

	/**
	 * Expires every right that is past `endsAt + gracePeriodDays`.
	 *
	 * This is the body of the `entitlement-expiry` pass: it selects the rows rather than being handed
	 * them, so the job that calls it has nothing to decide, and each row is expired through the same
	 * path an operator's expiry takes — one implementation, one event, one set of closed activations.
	 *
	 * @param limit How many rights one pass handles.
	 * @returns The ids of the rights that were expired.
	 */
	public async expireDue(limit = 100, scope: IEntitlementScope = {}): Promise<ID[]> {
		const candidates =
			this.ormType === MultiORMEnum.MikroORM
				? await this.findExpiryCandidatesThroughMikroOrm(limit, scope)
				: await this.findExpiryCandidates(limit, scope);

		const expired: ID[] = [];

		for (const candidate of candidates) {
			if (!isDueForExpiry(candidate, new Date())) {
				continue;
			}

			await this.expire(candidate.id, 'TERM_ENDED', scope);
			expired.push(candidate.id);
		}

		return expired;
	}

	/**
	 * Selects the rights the expiry pass examines: every right with a term that is not revoked, in the
	 * caller's tenant and organization, a page at a time.
	 *
	 * @param limit How many rights one pass handles.
	 * @param scope The tenant and organization the pass is scoped to.
	 * @returns The candidates; whether each is due is decided by the caller.
	 */
	private async findExpiryCandidates(limit: number, scope: IEntitlementScope): Promise<Entitlement[]> {
		// A perpetual right has no `endsAt` and is therefore never due; the predicate is stated in SQL
		// rather than as `Not(null)`, which would compare against NULL and match nothing at all.
		const query = this.typeOrmEntitlementRepository
			.createQueryBuilder('entitlement')
			.where('entitlement.status != :revoked', { revoked: EntitlementStatus.REVOKED })
			.andWhere('entitlement.endsAt IS NOT NULL')
			.take(limit);

		const tenantId = scope.tenantId ?? RequestContext.currentTenantId();
		const organizationId = scope.organizationId ?? RequestContext.currentOrganizationId();

		if (tenantId) {
			query.andWhere('entitlement.tenantId = :tenantId', { tenantId });
		}

		if (organizationId) {
			query.andWhere('entitlement.organizationId = :organizationId', { organizationId });
		}

		return await query.getMany();
	}

	/**
	 * The expiry pass's selection under MikroORM: the same three predicates and the same page, stated in
	 * find options. `endsAt` is asked for as not-null — `$ne: null`, which MikroORM writes as `IS NOT
	 * NULL` — so a perpetual right is never a candidate here either.
	 *
	 * @param limit How many rights one pass handles.
	 * @param scope The tenant and organization the pass is scoped to.
	 * @returns The candidates.
	 */
	private async findExpiryCandidatesThroughMikroOrm(limit: number, scope: IEntitlementScope): Promise<Entitlement[]> {
		const tenantId = scope.tenantId ?? RequestContext.currentTenantId();
		const organizationId = scope.organizationId ?? RequestContext.currentOrganizationId();

		return await mikroOrmEntitlementReader(this.mikroOrmEntitlementRepository).find(Entitlement, {
			where: {
				status: Not(EntitlementStatus.REVOKED),
				endsAt: Not(IsNull()),
				...(tenantId ? { tenantId } : {}),
				...(organizationId ? { organizationId } : {})
			},
			take: limit
		});
	}

	/**
	 * Re-derives the counters of one right, which is what the usage audit repairs with.
	 *
	 * The repair is a cache column and only a cache column: the live activations are the fact, and a
	 * count that disagrees with them is corrected here and named in the returned summary. Nothing
	 * business-visible is written — an over-count is reported, not revoked, because revocation is a
	 * customer-visible act and stays an operator's decision.
	 *
	 * @param id The right to reconcile.
	 * @returns What the reconciliation found and wrote.
	 */
	public async recount(id: ID): Promise<{ entitlementId: ID; activationCount: number }> {
		const entitlement = await this.findOneScoped(id);

		const activationCount = await this.transaction(async (manager) =>
			await recountEntitlementOccupancy(manager, entitlement.id)
		);

		const repaired = Number(entitlement.activationCount ?? 0) !== activationCount;

		if (repaired) {
			this.logger.warn(
				`entitlement-usage-audit: entitlement ${entitlement.id} counted ${entitlement.activationCount} activations and has ${activationCount}.`
			);
		}

		return { entitlementId: entitlement.id, activationCount };
	}

	/**
	 * Replaces the conditions attached to a right.
	 *
	 * The set is replaced rather than edited rule by rule, because the group indices and priorities of
	 * the other rows are part of the same expression — a partial update would let the set mean
	 * something its author never wrote.
	 *
	 * @param id The right.
	 * @param conditions The conditions the right should end up with.
	 * @param scope The tenant and organization the rule rows belong to.
	 * @returns Nothing.
	 * @throws BadRequestException when a condition cannot be evaluated as written, or when there is no
	 * scope to write the rules in.
	 */
	public async replaceConditions(
		id: ID,
		conditions: readonly EntitlementConditionDTO[],
		scope: IEntitlementScope = {}
	): Promise<void> {
		await this.findOneScoped(id, scope);

		// The rule engine scopes the rows it writes to the request context, and an event consumer has
		// none: writing conditions without one would store rules that no later request can read, which
		// is worse than refusing. A right granted by an event therefore carries the conditions its
		// tenant attaches to it afterwards, through the API.
		if (!scope.tenantId && !RequestContext.currentTenantId()) {
			throw new BadRequestException(
				'ENTITLEMENT_CONDITIONS_REQUIRE_CONTEXT: conditions are attached to a right through a request, and this call has no tenant to write them under.'
			);
		}

		const inputs = toRuleInputs(id, conditions);

		this.assertConditionsWritable(conditions);

		await this.ruleService.replaceOwnerRules(ENTITLEMENT_RULE_OWNER, id, inputs);
	}

	/**
	 * Reads a right with everything a detail view shows.
	 *
	 * @param id The right.
	 * @returns The right, with its activations, its keys and the party it was granted to.
	 * @throws NotFoundException when it is not the caller's.
	 */
	public async findOneDetailed(id: ID): Promise<Entitlement> {
		const entitlement = await this.entitlementRows().findOne({
			where: {
				id,
				...(RequestContext.currentTenantId() ? { tenantId: RequestContext.currentTenantId() } : {}),
				...(RequestContext.currentOrganizationId()
					? { organizationId: RequestContext.currentOrganizationId() }
					: {})
			} as any,
			relations: { customer: true, activations: true, keys: true }
		});

		if (!entitlement) {
			throw new NotFoundException('The entitlement was not found.');
		}

		return entitlement;
	}

	/**
	 * Reads a right, and refuses when it is not the caller's.
	 *
	 * @param id The right.
	 * @returns The right.
	 * @throws NotFoundException when it does not exist, or belongs to another tenant.
	 */
	public async findOneScoped(id: ID, scope: IEntitlementScope = {}): Promise<Entitlement> {
		const tenantId = scope.tenantId ?? RequestContext.currentTenantId();
		const organizationId = scope.organizationId ?? RequestContext.currentOrganizationId();

		const entitlement = await this.entitlementRows().findOne({
			where: {
				id,
				...(tenantId ? { tenantId } : {}),
				...(organizationId ? { organizationId } : {})
			} as any
		});

		if (!entitlement) {
			throw new NotFoundException('The entitlement was not found.');
		}

		return entitlement;
	}

	/**
	 * Opens one lifecycle transaction on the ORM the installation runs.
	 *
	 * Under TypeORM this is `typeOrmEntitlementRepository.manager.transaction(work)`, the transaction every
	 * transition here always opened; under MikroORM it is the repository's entity manager's own, and the
	 * body is handed a manager that answers the same calls through it (`entitlement-persistence.ts`). The
	 * body is one implementation either way — the lock, the decision, the version-predicated write and the
	 * outbox row are the same statements' worth of work on both.
	 *
	 * @param work The transaction body.
	 * @returns What the body answers.
	 */
	private async transaction<R>(work: (manager: EntityManager) => Promise<R>): Promise<R> {
		return await runEntitlementTransaction(
			this.ormType,
			() => this.typeOrmEntitlementRepository.manager,
			() => this.mikroOrmEntitlementRepository,
			work
		);
	}

	/**
	 * The repository a right is read through outside a transaction: the TypeORM one under TypeORM, and
	 * the same reads answered through MikroORM under MikroORM.
	 *
	 * @returns The repository.
	 */
	private entitlementRows(): Pick<Repository<Entitlement>, 'find' | 'findOne' | 'count' | 'update'> {
		return entitlementRowsOf(
			this.ormType,
			Entitlement,
			() => this.typeOrmEntitlementRepository,
			() => this.mikroOrmEntitlementRepository
		);
	}

	/**
	 * @param manager The caller's transaction manager.
	 * @param id The right.
	 * @param scope The tenant and organization the read is scoped to.
	 * @returns The right, under its row lock.
	 * @throws NotFoundException when it is not the caller's.
	 */
	private async requireLocked(
		manager: EntityManager,
		id: ID,
		scope: IEntitlementScope = {}
	): Promise<Entitlement> {
		const entitlement = await lockEntitlement(manager, id, scope);

		if (!entitlement) {
			throw new NotFoundException('The entitlement was not found.');
		}

		return entitlement;
	}

	/**
	 * Writes one right inside the caller's transaction, predicated on the version it was read at.
	 *
	 * The transaction-scoped writes cannot go through `commitVersionedUpdate`. That helper issues its
	 * own statement through the service, and a service write would step outside the caller's
	 * transaction — leaving behind the row lock the seat arithmetic and the lifecycle transitions are
	 * decided under, and leaving behind the outbox row the transaction exists for. So the transaction's
	 * own statement carries the predicate and the increment together, `UPDATE … SET …, version = :next
	 * WHERE id = :id AND version = :expected`, and a statement that matched no row means the right
	 * moved on between the read and this write: it is refused with the same conflict the guard answers
	 * with rather than applied on top of a change its caller never saw.
	 *
	 * The version to predicate on is the one the row was read at — under its lock wherever the caller
	 * took one, which is what makes that value authoritative inside this transaction — and it is the
	 * version the transition was decided from. What the caller accepted is a condition on that version,
	 * answered here before any statement runs:
	 *
	 * - **a wildcard** accepts any version the right holds, so the write is predicated on the one read;
	 * - **a list**, of one version or several, accepts only the versions it names. A right read at a
	 *   version the list does not name has moved past everything the caller accepted, and the write is
	 *   refused with the conflict the guard would have answered had it read the row itself.
	 *
	 * 🛑 The list case is the one that used to be wrong. Only a single version was checked; a list of
	 * several was treated as "a condition rather than a number" and the statement was predicated on
	 * whatever the locked row held — so `If-Match: "3", "4"` against a right at version 7 was written.
	 * The guard hands on the caller's **whole** list whenever its own read of the row failed, so that was
	 * a reachable lost update rather than a theoretical one. A list that names nothing accepts nothing,
	 * and is refused as the missing version it is, as `commitVersionedUpdate` refuses it.
	 *
	 * Predicating on the version read, rather than on the one the caller named, also refuses a write
	 * whose read was not locked and whose right moved on after it: the statement then matches no row.
	 *
	 * @param manager The caller's transaction manager.
	 * @param entitlement The right, as the caller read it.
	 * @param patch The columns to write. `version` is set here and must not be part of the patch.
	 * @param expectation The version the caller accepted, when the write has a caller.
	 * @returns Nothing.
	 * @throws ApiException with `VERSION_REQUIRED` when the caller accepted no version at all, and with
	 * `ENTITY_VERSION_CONFLICT` when the right does not hold, or no longer holds, a version it accepted.
	 */
	private async updateVersionedRow(
		manager: EntityManager,
		entitlement: Entitlement,
		patch: Record<string, unknown>,
		expectation: IVersionExpectation = ANY_VERSION
	): Promise<void> {
		if (!expectation.wildcard) {
			const accepted = expectation.versions ?? [];

			// The guard never leaves an empty list — `parseIfMatch` refuses one — so only a caller that
			// built the expectation by hand can, and predicating on the row would make it unconditional.
			if (accepted.length === 0) {
				throw new ApiException(
					428,
					ApiErrorCode.VERSION_REQUIRED,
					'This write must state the version it was based on, and no version was accepted for it.'
				);
			}

			// The version read is compared as the kernel reads one, so a driver that answers the integer
			// column as text is not mistaken for a right that moved on.
			const current = parseEntityVersion(entitlement.version);

			if (current === null || !accepted.includes(current)) {
				throw new ApiException(
					409,
					ApiErrorCode.ENTITY_VERSION_CONFLICT,
					'The record changed since you read it. Read it again and reapply your change.',
					{ expectedVersion: accepted[0], actualVersion: entitlement.version }
				);
			}
		}

		const expected = entitlement.version;

		// The patch is typed loosely on purpose: `version` is a convention the entity opts into with
		// `@VersionedColumn()` rather than a member of the base entity, so it cannot be expressed in
		// `Partial<Entitlement>`. The increment rides in the same statement as the predicate, which is
		// what leaves no window between checking the version and moving it, and `bumpVersion` is the
		// kernel's own answer to what comes after a revision rather than a second rule stated here.
		const result = await manager.update(
			Entitlement,
			{ id: entitlement.id, version: expected } as any,
			{ ...patch, version: bumpVersion(expected) } as any
		);

		if (Number((result as UpdateResult)?.affected ?? 0) > 0) {
			return;
		}

		throw new ApiException(
			409,
			ApiErrorCode.ENTITY_VERSION_CONFLICT,
			'The record changed since you read it. Read it again and reapply your change.',
			{ expectedVersion: expected, actualVersion: entitlement.version }
		);
	}

	/**
	 * Looks for the right a grant would duplicate.
	 *
	 * The provenance is the identity: one granting line grants one right of a kind, and one
	 * subscription renewal extends the right it started rather than granting a second one. A revoked
	 * right does not count as a duplicate — a customer whose licence was withdrawn and granted again
	 * has two rights, and the history is the point.
	 *
	 * @param input The grant.
	 * @param kind The kind being granted.
	 * @param scope The tenant and organization the lookup is scoped to.
	 * @returns The existing right, or null.
	 */
	private async findExistingGrant(
		input: IEntitlementGrantInput,
		kind: EntitlementKind,
		scope: IEntitlementScope = {}
	): Promise<Entitlement | null> {
		if (!input.orderLineId && !input.subscriptionId && !input.number) {
			return null;
		}

		const where: Record<string, unknown> = { kind, status: Not(EntitlementStatus.REVOKED) };
		const tenantId = scope.tenantId ?? RequestContext.currentTenantId();
		const organizationId = scope.organizationId ?? RequestContext.currentOrganizationId();

		if (input.orderLineId) {
			where.orderLineId = input.orderLineId;
		} else if (input.subscriptionId) {
			where.subscriptionId = input.subscriptionId;
			if (input.productId) {
				where.productId = input.productId;
			}
			if (input.variantId) {
				where.variantId = input.variantId;
			}
		} else {
			where.number = input.number;
		}

		if (tenantId) {
			where.tenantId = tenantId;
		}

		if (organizationId) {
			where.organizationId = organizationId;
		}

		const existing = await this.entitlementRows().findOne({
			where: where as any,
			order: { createdAt: 'DESC' } as any
		});

		if (existing) {
			this.logger.debug(`Grant replayed against ${input.orderLineId ?? input.subscriptionId ?? input.number}; returning ${existing.id}.`);
		}

		return existing ?? null;
	}

	/**
	 * @param conditions The conditions a request stated.
	 * @throws BadRequestException listing every problem found, before anything is written.
	 */
	private assertConditionsWritable(conditions?: readonly EntitlementConditionDTO[]): void {
		for (const condition of conditions ?? []) {
			this.ruleService.assertWritable({
				ownerType: ENTITLEMENT_RULE_OWNER,
				ownerId: 'pending',
				attribute: condition.attribute,
				operator: condition.operator as IRuleCreateInput['operator']
			} as IRuleCreateInput);
		}
	}

	/**
	 * Allocates the next right number.
	 *
	 * The platform's numbering series is the answer whenever there is a request context to scope it
	 * by, because that is what makes a tenant's rights number like its orders and its invoices.
	 *
	 * An event consumer has no request context — the numbering series is read from one — so a grant
	 * replayed from an order or a subscription is numbered from its own provenance instead, which is
	 * deterministic, unique per granting line and kind, and says which purchase it came from. An
	 * operator's grant with no provenance at all still has to have a series, and the failure names the
	 * key rather than reporting a generic not-found.
	 *
	 * @param input What grants the right.
	 * @returns The formatted number.
	 * @throws BadRequestException when no number can be allocated or derived.
	 */
	private async allocateNumber(input: IEntitlementGrantInput): Promise<string> {
		try {
			const allocated = await this.sequenceService.allocate(ENTITLEMENT_NUMBER_KEY);

			return allocated.formatted;
		} catch (error) {
			const derived = this.deriveNumber(input);

			if (derived) {
				this.logger.warn(
					`No numbering series "${ENTITLEMENT_NUMBER_KEY}" is reachable for this grant, so the right is numbered from its provenance as "${derived}".`
				);

				return derived;
			}

			throw new BadRequestException(
				`No numbering series is configured for entitlements (key "${ENTITLEMENT_NUMBER_KEY}"), so a right cannot be numbered.`
			);
		}
	}

	/**
	 * @param input What grants the right.
	 * @returns A number derived from the purchase that granted it, or undefined when it came from no
	 * purchase.
	 */
	private deriveNumber(input: IEntitlementGrantInput): string | undefined {
		const kind = (input.kind ?? EntitlementKind.LICENCE).charAt(0);
		const short = (value: ID): string => String(value).replace(/-/g, '').slice(0, 8).toUpperCase();

		if (input.orderId && input.orderLineId) {
			return `E-${short(input.orderId)}-${short(input.orderLineId)}-${kind}`;
		}

		if (input.subscriptionId) {
			return `E-SUB-${short(input.subscriptionId)}-${kind}`;
		}

		return undefined;
	}
}
