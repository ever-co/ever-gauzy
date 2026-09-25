import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EntityManager, FindOptionsWhere, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ID } from '@gauzy/contracts';
import { EventBus, EventOutboxService, RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { Entitlement } from '../entitlement/entitlement.entity';
import { EntitlementActivation } from './entitlement-activation.entity';
import { EntitlementKey } from '../entitlement-key/entitlement-key.entity';
import { EntitlementActivationStatus, EntitlementKeyStatus, DEFAULT_LAST_SEEN_THROTTLE_MS } from '../entitlement.enums';
import {
	EntitlementCheckReason,
	EntitlementEventName,
	IEntitlementActivationInput,
	IEntitlementActivationResult
} from '../entitlement.types';
import { EntitlementActivatedEvent, EntitlementChangedEvent } from '../events/entitlement.events';
import { digestLicenceKey } from '../entitlement-key/licence-key';
import { EntitlementKeyService } from '../entitlement-key/entitlement-key.service';
import { EntitlementCheckService } from '../entitlement-check/entitlement-check.service';
import { countLiveActivations, recountEntitlementOccupancy } from '../entitlement-counts';
import { lockEntitlement } from '../entitlement-lock';
import { evaluateEntitlementState, remainingQuantity } from '../entitlement-check/entitlement-rules';
import { MikroOrmEntitlementActivationRepository } from './repository/mikro-orm-entitlement-activation.repository';
import { TypeOrmEntitlementActivationRepository } from './repository/type-orm-entitlement-activation.repository';

/**
 * Revocation reasons that bar the device from taking a new slot.
 *
 * The unit a revoked activation held returns to the right, as §19.2 says it does; what the reason
 * decides is whether the *same device* may immediately take it back. A support agent replacing a
 * machine records an ordinary reason and the customer re-activates; a device withdrawn for sharing a
 * credential or for fraud is named here and is refused, because otherwise the revocation would be a
 * formality the customer could undo by trying again.
 */
export const RE_ACTIVATION_BLOCKING_REASONS: string[] = ['KEY_SHARING', 'FRAUD', 'ABUSE'];

/**
 * The members of an activation only its own operations write, which an edit therefore refuses.
 *
 * Each is written by the path that takes, releases or revokes a slot, and each is what a rule of that path
 * is decided over:
 *
 * - `status`, with `activatedAt`, `deactivatedAt`, `revokedAt` and `revokedByUserId` — the slot's state and
 *   the record of its moves. A `REVOKED` slot set back to `ACTIVE` by an edit sits beside the one that
 *   replaced it, past `activationLimit`, because the limit is counted only when a slot is taken;
 * - `entitlementId` — the right the slot is counted against; repointing it skips that right's ceiling;
 * - `entitlementKeyId` — the key whose revocation releases the slot; detaching it lets the slot outlive
 *   the key;
 * - `deviceId` — the identity the seat count and the device bar are taken over (§19.2);
 * - `revocationReason` — which decides whether a revoked device may activate again.
 */
export const ENTITLEMENT_ACTIVATION_LIFECYCLE_MEMBERS: readonly string[] = [
	'status',
	'activatedAt',
	'deactivatedAt',
	'revokedAt',
	'revokedByUserId',
	'entitlementId',
	'entitlementKeyId',
	'deviceId',
	'revocationReason'
];

/**
 * Taking, giving back and being deprived of a slot.
 *
 * This is where the seat arithmetic lives, and it is deliberately the only place: an activation is
 * created here, and the counters on the entitlement and on the key are re-derived here from the rows
 * this service wrote. Every path that takes a slot runs the same three steps in the same order —
 * lock the right, count the live activations, then decide — which is what makes two devices
 * activating at the same instant unable to both take the last seat.
 *
 * The seat ceiling and the activation ceiling are two different questions and both are asked:
 * `quantity` is what the customer bought, and `activationLimit` is what the right permits at once
 * when that is tighter.
 */
@Injectable()
export class EntitlementActivationService extends TenantAwareCrudService<EntitlementActivation> {
	private readonly logger = new Logger(EntitlementActivationService.name);

	constructor(
		readonly typeOrmEntitlementActivationRepository: TypeOrmEntitlementActivationRepository,
		readonly mikroOrmEntitlementActivationRepository: MikroOrmEntitlementActivationRepository,
		private readonly entitlementKeyService: EntitlementKeyService,
		private readonly entitlementCheckService: EntitlementCheckService,
		private readonly outbox: EventOutboxService,
		private readonly eventBus: EventBus
	) {
		super(typeOrmEntitlementActivationRepository, mikroOrmEntitlementActivationRepository);
	}

	/**
	 * Occupies a slot of a right.
	 *
	 * The whole decision runs inside one transaction under the entitlement's row lock, so the count
	 * that decides cannot be stale by the time the row is written. A retried first run is idempotent
	 * by construction rather than by bookkeeping: the live-activation rule means the second attempt
	 * finds the row the first one wrote and refreshes it instead of taking a second slot.
	 *
	 * @param input The right, the device and — when one is used — the licence key.
	 * @returns The activation, the right it occupies a slot of, and what is left afterwards.
	 * @throws NotFoundException when the right is not the caller's.
	 * @throws BadRequestException when the right refuses the activation, carrying the stable code.
	 */
	public async activate(input: IEntitlementActivationInput): Promise<IEntitlementActivationResult> {
		if (!input?.deviceId) {
			throw new BadRequestException('ENTITLEMENT_DEVICE_REQUIRED: an activation must name the device it is for.');
		}

		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const userId = RequestContext.currentUserId();
		const now = new Date();

		const outcome = await this.typeOrmEntitlementActivationRepository.manager.transaction(async (manager) => {
			const entitlement = await lockEntitlement(manager, input.entitlementId);

			if (!entitlement) {
				throw new NotFoundException('The entitlement was not found.');
			}

			const key = input.key ? await this.requireKey(manager, input.key, entitlement.id) : null;

			// A device that already holds a slot is not taking a second one: the first run's row is
			// refreshed and returned, which is what makes a retry safe and what the partial unique
			// index over the live rows guarantees underneath.
			const existing = await manager.findOne(EntitlementActivation, {
				where: {
					entitlementId: entitlement.id,
					deviceId: input.deviceId,
					status: EntitlementActivationStatus.ACTIVE
				} as any
			});

			if (existing) {
				await this.refreshLastSeen(manager, existing, input.seenIntervalSeconds, now);

				return {
					activation: (await manager.findOne(EntitlementActivation, {
						where: { id: existing.id } as any
					})) as EntitlementActivation,
					entitlement,
					created: false
				};
			}

			await this.assertDeviceNotBarred(manager, entitlement.id, input.deviceId);

			if (key && key.status === EntitlementKeyStatus.ACTIVATED) {
				// The key is spent. It may only be re-presented by the device it was spent on, which the
				// live-activation lookup above has already ruled out.
				throw new BadRequestException(
					`${EntitlementCheckReason.KEY_USED}: this key has already been activated, and a key is activated at most once.`
				);
			}

			const live = await countLiveActivations(manager, entitlement.id);
			const verdict = evaluateEntitlementState(entitlement, { liveActivations: live }, now);

			if (!verdict.allowed) {
				throw new BadRequestException(
					`${verdict.reason}: the entitlement does not permit an activation (${
						Number(entitlement.quantity) === 0 ? 'unlimited' : `${live}/${entitlement.quantity}`
					} seats in use).`
				);
			}

			const conditions = await this.entitlementCheckService.evaluateConditions(entitlement, input, {
				deviceId: input.deviceId,
				seatReference: input.seatReference,
				liveActivations: live
			});

			if (!conditions.matched) {
				throw new BadRequestException(
					`${EntitlementCheckReason.CONDITIONS_NOT_MET}: ${conditions.failedRules.join(', ') || 'the conditions attached to this entitlement did not match'}.`
				);
			}

			const row = manager.create(EntitlementActivation, {
				entitlementId: entitlement.id,
				entitlementKeyId: key?.id ?? null,
				deviceId: input.deviceId,
				deviceName: input.deviceName ?? null,
				fingerprint: input.fingerprint ?? null,
				seatReference: input.seatReference ?? null,
				activatedByCustomerId: input.activatedByCustomerId ?? null,
				status: EntitlementActivationStatus.ACTIVE,
				activatedAt: now,
				lastSeenAt: now,
				ipAddress: input.ipAddress ?? RequestContext.currentIp() ?? null,
				userAgent: input.userAgent ?? RequestContext.currentUserAgent() ?? null,
				metadata: (input.metadata as any) ?? null,
				...(tenantId ? { tenantId } : {}),
				...(organizationId ? { organizationId } : {}),
				...(userId ? { createdByUserId: userId } : {})
			} as Partial<EntitlementActivation>);

			const saved = await manager.save(EntitlementActivation, row);

			if (key) {
				await this.entitlementKeyService.consume(manager, key);
			}

			const liveAfter = await recountEntitlementOccupancy(manager, entitlement.id);

			await this.outbox.append(manager, {
				name: EntitlementEventName.ACTIVATED,
				aggregateType: 'ENTITLEMENT',
				aggregateId: entitlement.id as ID,
				data: {
					entitlementId: entitlement.id,
					activationId: saved.id,
					customerId: entitlement.customerId ?? null,
					kind: entitlement.kind,
					quantity: entitlement.quantity,
					activatedAt: now,
					deviceId: saved.deviceId,
					seatReference: saved.seatReference ?? null,
					// The key is named by its row and its prefix. The plaintext of a credential is
					// returned once, in the response to the call that issued it, and is never an event.
					keyId: key?.id ?? null,
					keyPrefix: key?.keyPrefix ?? null,
					liveActivations: liveAfter
				},
				tenantId,
				organizationId
			});

			const activation = (await manager.findOne(EntitlementActivation, {
				where: { id: saved.id } as any
			})) as EntitlementActivation;
			const refreshed = (await manager.findOne(Entitlement, {
				where: { id: entitlement.id } as any
			})) as Entitlement;

			return { activation, entitlement: refreshed, created: true, liveAfter };
		});

		if (outcome.created) {
			await this.eventBus.publish(
				new EntitlementActivatedEvent(
					outcome.entitlement.id,
					outcome.activation.id,
					outcome.activation.deviceId,
					outcome.entitlement.organizationId
				)
			);
		}

		return {
			activation: outcome.activation,
			entitlement: outcome.entitlement,
			created: outcome.created,
			remainingQuantity: remainingQuantity(outcome.entitlement, {
				liveActivations: Number(outcome.entitlement.activationCount ?? 0)
			})
		};
	}

	/**
	 * Corrects the descriptive fields of a slot — its device name, fingerprint, seat reference, buyer,
	 * last-seen instant, client details and metadata — and nothing its lifecycle owns.
	 *
	 * This is the write behind `PUT /entitlement-activations/:id` and `updateEntitlementActivation`, both
	 * under `ENTITLEMENTS_EDIT`. The inherited update writes every member it is handed, and both surfaces
	 * used to hand it the slot's state and identity; the members in
	 * {@link ENTITLEMENT_ACTIVATION_LIFECYCLE_MEMBERS} are refused here, before anything is written,
	 * whichever surface or caller names them. A member counts as named when it carries a value: `undefined`
	 * is how a DTO instance and an input both spell "not stated", and `null` is a value. The rest of the
	 * write — its tenant scoping included — is the base's.
	 *
	 * @param id The activation, or the conditions it must satisfy.
	 * @param partialEntity The fields to change.
	 * @returns The update result, or the updated row, whichever the ORM answers.
	 * @throws BadRequestException naming every refused member the partial carries.
	 */
	public async update(
		id: string | FindOptionsWhere<EntitlementActivation>,
		partialEntity: QueryDeepPartialEntity<EntitlementActivation>
	): Promise<EntitlementActivation | UpdateResult> {
		const named = ENTITLEMENT_ACTIVATION_LIFECYCLE_MEMBERS.filter(
			(member) => (partialEntity as Record<string, unknown>)?.[member] !== undefined
		);

		if (named.length > 0) {
			throw new BadRequestException(
				`ENTITLEMENT_ACTIVATION_FIELD_NOT_EDITABLE: ${named.join(', ')} ${
					named.length === 1 ? 'is' : 'are'
				} not written by an edit; a slot is taken through activate and given back through release or revoke.`
			);
		}

		return await super.update(id, partialEntity);
	}

	/**
	 * Gives a slot back, because the holder chose to.
	 *
	 * `RELEASED` rather than `REVOKED`: the two are the same arithmetic and different audit facts, and
	 * the whole reason the activation status is an enum is that a licence report has to be able to
	 * tell "the customer uninstalled it" from "we took it away".
	 *
	 * @param id The activation to release.
	 * @param reason An optional note kept beside the release.
	 * @returns The released activation.
	 * @throws NotFoundException when it is not the caller's.
	 */
	public async release(id: ID, reason?: string): Promise<EntitlementActivation> {
		return await this.closeOut(id, EntitlementActivationStatus.RELEASED, reason);
	}

	/**
	 * Takes a slot away, because support or a policy decided to.
	 *
	 * @param id The activation to revoke.
	 * @param reason Why, which also decides whether the device may activate again.
	 * @returns The revoked activation.
	 * @throws NotFoundException when it is not the caller's.
	 */
	public async revoke(id: ID, reason: string): Promise<EntitlementActivation> {
		return await this.closeOut(id, EntitlementActivationStatus.REVOKED, reason);
	}

	/**
	 * Refreshes when a client was last seen, at most once per configured interval.
	 *
	 * Validation is a read with one small write, and the throttle is what keeps a client that
	 * validates on every launch from turning the endpoint into a write amplifier.
	 *
	 * @param id The activation.
	 * @param intervalSeconds An explicit interval, when the caller states one.
	 * @returns The activation, after the refresh.
	 * @throws NotFoundException when it is not the caller's.
	 */
	public async touch(id: ID, intervalSeconds?: number): Promise<EntitlementActivation> {
		const activation = await this.findOneScoped(id);

		await this.typeOrmEntitlementActivationRepository.manager.transaction(async (manager) => {
			await this.refreshLastSeen(manager, activation, intervalSeconds, new Date());
		});

		return await this.findOneScoped(id);
	}

	/**
	 * @param entitlementId The right.
	 * @returns Its activations, newest first, live ones included.
	 */
	public async findForEntitlement(entitlementId: ID): Promise<EntitlementActivation[]> {
		return await this.typeOrmEntitlementActivationRepository.find({
			where: {
				entitlementId,
				...(RequestContext.currentTenantId() ? { tenantId: RequestContext.currentTenantId() } : {}),
				...(RequestContext.currentOrganizationId()
					? { organizationId: RequestContext.currentOrganizationId() }
					: {})
			} as any,
			order: { activatedAt: 'DESC' } as any
		});
	}

	/**
	 * Reads an activation, and refuses when it is not the caller's.
	 *
	 * @param id The activation.
	 * @returns The activation.
	 * @throws NotFoundException when it does not exist, or belongs to another tenant.
	 */
	public async findOneScoped(id: ID): Promise<EntitlementActivation> {
		const activation = await this.typeOrmEntitlementActivationRepository.findOne({
			where: {
				id,
				...(RequestContext.currentTenantId() ? { tenantId: RequestContext.currentTenantId() } : {}),
				...(RequestContext.currentOrganizationId()
					? { organizationId: RequestContext.currentOrganizationId() }
					: {})
			} as any
		});

		if (!activation) {
			throw new NotFoundException('The activation was not found.');
		}

		return activation;
	}

	/**
	 * Closes every live activation of a right, inside the caller's transaction.
	 *
	 * Called by the entitlement service when a right is revoked or expired: an activation cannot
	 * outlive the right it occupies a slot of, and closing it here rather than through the ordinary
	 * endpoint is what keeps the revocation one transaction.
	 *
	 * @param manager The caller's transaction manager.
	 * @param entitlementId The right.
	 * @param status The terminal status to write: `REVOKED` for a withdrawal, `EXPIRED` for a lapse.
	 * @param reason Why.
	 * @returns The ids of the activations that were closed.
	 */
	public async closeAllForEntitlement(
		manager: EntityManager,
		entitlementId: ID,
		status: EntitlementActivationStatus,
		reason: string
	): Promise<ID[]> {
		const live = await manager.find(EntitlementActivation, {
			where: { entitlementId, status: EntitlementActivationStatus.ACTIVE } as any
		});
		const userId = RequestContext.currentUserId();
		const now = new Date();
		const closed: ID[] = [];

		for (const activation of live) {
			await manager.update(
				EntitlementActivation,
				{ id: activation.id } as any,
				{
					status,
					...(status === EntitlementActivationStatus.REVOKED
						? { revokedAt: now, revocationReason: reason }
						: { deactivatedAt: now }),
					...(userId ? { revokedByUserId: userId } : {})
				} as any
			);
			closed.push(activation.id);
		}

		return closed;
	}

	/**
	 * @param manager The caller's transaction manager.
	 * @param plaintext The key the caller presented.
	 * @param entitlementId The right the activation is against.
	 * @returns The key row.
	 * @throws BadRequestException when no key matches, when the key is withdrawn or expired, or when
	 * it belongs to a different right.
	 */
	private async requireKey(manager: EntityManager, plaintext: string, entitlementId: ID): Promise<EntitlementKey> {
		// One indexed probe inside the same transaction the activation is written in, so a key revoked
		// by a concurrent call cannot be consumed by this one.
		const key = await manager.findOne(EntitlementKey, {
			where: {
				keyHash: digestLicenceKey(plaintext),
				...(RequestContext.currentTenantId() ? { tenantId: RequestContext.currentTenantId() } : {}),
				...(RequestContext.currentOrganizationId()
					? { organizationId: RequestContext.currentOrganizationId() }
					: {})
			} as any
		});

		if (!key || (key.entitlementId && key.entitlementId !== entitlementId)) {
			throw new BadRequestException(
				`${EntitlementCheckReason.KEY_NOT_FOUND}: this key was not issued for this entitlement.`
			);
		}

		return key;
	}

	/**
	 * @param manager The caller's transaction manager.
	 * @param entitlementId The right.
	 * @param deviceId The device asking for a slot.
	 * @throws BadRequestException when a previous activation of the same device was revoked for a
	 * reason that bars it from returning.
	 */
	private async assertDeviceNotBarred(manager: EntityManager, entitlementId: ID, deviceId: string): Promise<void> {
		const barred = await manager.findOne(EntitlementActivation, {
			where: {
				entitlementId,
				deviceId,
				status: EntitlementActivationStatus.REVOKED
			} as any,
			order: { revokedAt: 'DESC' } as any
		});

		if (barred?.revocationReason && RE_ACTIVATION_BLOCKING_REASONS.includes(barred.revocationReason)) {
			throw new BadRequestException(
				`ENTITLEMENT_DEVICE_BARRED: this device was withdrawn for "${barred.revocationReason}" and may not activate again.`
			);
		}
	}

	/**
	 * Writes the end of an activation and re-derives the counters in the same transaction.
	 *
	 * @param id The activation.
	 * @param status `RELEASED` or `REVOKED`.
	 * @param reason Why.
	 * @returns The activation, after the transition.
	 */
	private async closeOut(
		id: ID,
		status: EntitlementActivationStatus,
		reason?: string
	): Promise<EntitlementActivation> {
		const activation = await this.findOneScoped(id);

		// Already closed: returning it unchanged keeps a retried support action from emitting a second
		// event about a slot that was given back once.
		if (activation.status !== EntitlementActivationStatus.ACTIVE) {
			return activation;
		}

		const userId = RequestContext.currentUserId();
		const now = new Date();

		await this.typeOrmEntitlementActivationRepository.manager.transaction(async (manager) => {
			await manager.update(
				EntitlementActivation,
				{ id: activation.id } as any,
				{
					status,
					...(status === EntitlementActivationStatus.REVOKED
						? { revokedAt: now, revocationReason: reason ?? null }
						: { deactivatedAt: now, revocationReason: reason ?? null }),
					...(userId ? { revokedByUserId: userId } : {})
				} as any
			);

			const liveAfter = await recountEntitlementOccupancy(manager, activation.entitlementId);

			await this.outbox.append(manager, {
				name: EntitlementEventName.DEACTIVATED,
				aggregateType: 'ENTITLEMENT',
				aggregateId: activation.entitlementId as ID,
				data: {
					entitlementId: activation.entitlementId,
					activationId: activation.id,
					deviceId: activation.deviceId,
					status,
					reason: reason ?? null,
					deactivatedAt: now,
					liveActivations: liveAfter
				},
				tenantId: activation.tenantId,
				organizationId: activation.organizationId
			});
		});

		const closed = await this.findOneScoped(id);

		await this.eventBus.publish(new EntitlementChangedEvent(closed.entitlementId, closed.organizationId));

		return closed;
	}

	/**
	 * @param manager The caller's transaction manager.
	 * @param activation The live activation.
	 * @param intervalSeconds The throttle, when the caller states one.
	 * @param now The instant of the call.
	 */
	private async refreshLastSeen(
		manager: EntityManager,
		activation: EntitlementActivation,
		intervalSeconds: number | undefined,
		now: Date
	): Promise<void> {
		const throttleSeconds = Number.isFinite(Number(intervalSeconds))
			? Number(intervalSeconds)
			: DEFAULT_LAST_SEEN_THROTTLE_MS / 1000;

		if (
			activation.lastSeenAt &&
			now.getTime() - new Date(activation.lastSeenAt).getTime() < throttleSeconds * 1000
		) {
			return;
		}

		await manager.update(
			EntitlementActivation,
			{ id: activation.id } as any,
			{ lastSeenAt: now } as any
		);

		this.logger.debug(`Refreshed last-seen of activation ${activation.id}.`);
	}
}
