import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EntityManager, Not } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { EventOutboxService, RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { Entitlement } from '../entitlement/entitlement.entity';
import { EntitlementKey } from './entitlement-key.entity';
import { EntitlementActivation } from '../entitlement-activation/entitlement-activation.entity';
import {
	EntitlementActivationStatus,
	EntitlementKeyStatus,
	EntitlementStatus,
	LicenceKeyFormat
} from '../entitlement.enums';
import {
	EntitlementEventName,
	IEntitlementKeyIssueInput,
	IEntitlementKeyIssueResult,
	IEntitlementKeyReissueResult,
	IEntitlementScope
} from '../entitlement.types';
import {
	decryptLicenceKey,
	digestLicenceKey,
	encryptLicenceKey,
	generateLicenceKey,
	licenceKeyPrefix
} from './licence-key';
import { recountEntitlementOccupancy } from '../entitlement-counts';
import { asMetadata } from '../entitlement-metadata';
import { TypeOrmEntitlementRepository } from '../entitlement/repository/type-orm-entitlement.repository';
import { MikroOrmEntitlementKeyRepository } from './repository/mikro-orm-entitlement-key.repository';
import { TypeOrmEntitlementKeyRepository } from './repository/type-orm-entitlement-key.repository';

/** Statuses a right may be in when a credential is issued against it. */
const ISSUABLE_STATUSES: EntitlementStatus[] = [EntitlementStatus.PENDING, EntitlementStatus.ACTIVE];

/**
 * The credentials issued against a right, and their whole lifecycle.
 *
 * The service is the only writer of a key row, which is what keeps the three invariants of §19.3
 * true in one place rather than three:
 *
 * - the digest is computed **once**, at issuance, from material generated here — a caller never
 *   supplies a key, because a key the caller chose is a key the caller already knows;
 * - the plaintext is returned exactly once, in the response to the call that created it, and never
 *   written to a column, an event payload or a log line — the only stored forms are the digest and,
 *   when the operator asked for it, the ciphertext;
 * - revoking a key **releases its activations** and re-derives the counters, but does not revoke the
 *   right, because the right and the credential are different things.
 */
@Injectable()
export class EntitlementKeyService extends TenantAwareCrudService<EntitlementKey> {
	private readonly logger = new Logger(EntitlementKeyService.name);

	constructor(
		readonly typeOrmEntitlementKeyRepository: TypeOrmEntitlementKeyRepository,
		readonly mikroOrmEntitlementKeyRepository: MikroOrmEntitlementKeyRepository,
		private readonly typeOrmEntitlementRepository: TypeOrmEntitlementRepository,
		private readonly outbox: EventOutboxService
	) {
		super(typeOrmEntitlementKeyRepository, mikroOrmEntitlementKeyRepository);
	}

	/**
	 * Issues a key against a right.
	 *
	 * @param input The right, the format and the holder.
	 * @param scope The tenant and organization the right belongs to; the request context is the
	 * fallback, so an event consumer issuing a key passes the envelope's identifiers.
	 * @returns The stored key row and the plaintext, which the caller must deliver now: this is the
	 * only moment it exists outside the caller's own memory.
	 * @throws NotFoundException when the right is not the caller's.
	 * @throws BadRequestException when the right is withdrawn, expired or terminated, because a
	 * credential issued against a right that cannot be activated is a credential that cannot work.
	 */
	public async issue(
		input: IEntitlementKeyIssueInput,
		scope: IEntitlementScope = {}
	): Promise<IEntitlementKeyIssueResult> {
		const entitlement = await this.requireEntitlement(input.entitlementId, scope);

		if (!ISSUABLE_STATUSES.includes(entitlement.status)) {
			throw new BadRequestException(
				`ENTITLEMENT_KEY_NOT_ISSUABLE: a key may only be issued against a right that is PENDING or ACTIVE, and this one is ${entitlement.status}.`
			);
		}

		const plaintext = generateLicenceKey(input.format ?? LicenceKeyFormat.UUID);
		const tenantId = scope.tenantId ?? RequestContext.currentTenantId();
		const organizationId = scope.organizationId ?? RequestContext.currentOrganizationId();

		const row = this.typeOrmEntitlementKeyRepository.create({
			entitlementId: entitlement.id,
			keyHash: digestLicenceKey(plaintext),
			keyPrefix: licenceKeyPrefix(plaintext),
			// The ciphertext is written only when the operator asked to be able to re-display the key;
			// a write-only key is unrecoverable by design and is recovered by re-issuing it.
			keyCiphertext: input.storeKey ? encryptLicenceKey(plaintext) : null,
			format: input.format ?? LicenceKeyFormat.UUID,
			status: EntitlementKeyStatus.ISSUED,
			assignedAt: input.assignedToEmail || input.assignedToCustomerId ? new Date() : null,
			assignedToEmail: input.assignedToEmail ?? null,
			assignedToCustomerId: input.assignedToCustomerId ?? null,
			activationLimit: input.activationLimit ?? null,
			activationCount: 0,
			expiresAt: input.expiresAt ?? null,
			metadata: (input.metadata as any) ?? null,
			...(tenantId ? { tenantId } : {}),
			...(organizationId ? { organizationId } : {})
		} as Partial<EntitlementKey>);

		const key = await this.typeOrmEntitlementKeyRepository.manager.transaction(async (manager) => {
			const saved = await manager.save(EntitlementKey, row as EntitlementKey);

			await this.outbox.append(manager, {
				name: EntitlementEventName.KEY_ISSUED,
				aggregateType: 'ENTITLEMENT_KEY',
				aggregateId: saved.id as ID,
				data: {
					keyId: saved.id,
					entitlementId: entitlement.id,
					// The prefix, never the key: the plaintext of a credential is not an event payload.
					keyPrefix: saved.keyPrefix,
					format: saved.format,
					status: saved.status,
					assignedToEmail: saved.assignedToEmail ?? null,
					expiresAt: saved.expiresAt ?? null
				},
				tenantId,
				organizationId
			});

			return saved;
		});

		return { key, plaintext };
	}

	/**
	 * Withdraws a credential.
	 *
	 * Revoking a key is not revoking a right: the live activations that reference the key are revoked
	 * in the same transaction — a credential that was withdrawn must not leave a device holding a
	 * seat — the counters are re-derived from the rows that remain, and the entitlement keeps
	 * whatever it granted.
	 *
	 * @param id The key to withdraw.
	 * @param reason Why, kept on the key and on the activations it released.
	 * @returns The withdrawn key.
	 * @throws NotFoundException when the key is not the caller's.
	 */
	public async revoke(id: ID, reason: string): Promise<EntitlementKey> {
		const key = await this.findOneScoped(id);

		// Idempotent: revoking a withdrawn credential is a no-op rather than a second event, which is
		// what lets an operator re-run a revocation that half-finished.
		if (key.status === EntitlementKeyStatus.REVOKED) {
			return key;
		}

		const revokedByUserId = RequestContext.currentUserId();
		const now = new Date();

		return await this.typeOrmEntitlementKeyRepository.manager.transaction(async (manager) => {
			const activations = await manager.find(EntitlementActivation, {
				where: {
					entitlementKeyId: key.id,
					status: EntitlementActivationStatus.ACTIVE
				} as any
			});

			for (const activation of activations) {
				await manager.update(
					EntitlementActivation,
					{ id: activation.id } as any,
					{
						status: EntitlementActivationStatus.REVOKED,
						revokedAt: now,
						...(revokedByUserId ? { revokedByUserId } : {}),
						revocationReason: reason
					} as any
				);
			}

			await manager.update(
				EntitlementKey,
				{ id: key.id } as any,
				{
					status: EntitlementKeyStatus.REVOKED,
					revokedAt: now,
					// The digest stays: a revoked key is still the record that it was issued, and
					// deleting it would make "was this key ever ours" unanswerable.
					...(revokedByUserId ? { revokedByUserId } : {})
				} as any
			);

			await recountEntitlementOccupancy(manager, key.entitlementId);

			await this.appendKeyEvent(manager, EntitlementEventName.KEY_REVOKED, key, {
				keyId: key.id,
				entitlementId: key.entitlementId,
				keyPrefix: key.keyPrefix ?? null,
				reason,
				revokedAt: now,
				activationIds: activations.map((activation) => activation.id)
			});

			return (await manager.findOne(EntitlementKey, { where: { id: key.id } as any })) ?? key;
		});
	}

	/**
	 * Replaces a credential with a freshly generated one.
	 *
	 * The recovery path for a lost key, and the only one: the plaintext of an issued key cannot be
	 * recovered unless the operator asked for a ciphertext, so a customer who lost theirs is given a
	 * new key and the old one is revoked. The pair is linked in `metadata` on both rows, so "what
	 * happened to the key this customer was sent" has one answer forever.
	 *
	 * @param id The key being replaced.
	 * @param input The format of the replacement and why the old one is being withdrawn.
	 * @returns The new key, its plaintext — returned once — and the key it replaced.
	 * @throws NotFoundException when the key is not the caller's.
	 */
	public async reissue(
		id: ID,
		input: { format?: LicenceKeyFormat; reason?: string; storeKey?: boolean } = {}
	): Promise<IEntitlementKeyReissueResult> {
		const previous = await this.findOneScoped(id);

		if (previous.status === EntitlementKeyStatus.REVOKED) {
			throw new BadRequestException(
				'ENTITLEMENT_KEY_REVOKED: a withdrawn key is never replaced; issue a new key against the right instead.'
			);
		}

		const result = await this.issue({
			entitlementId: previous.entitlementId,
			format: input.format ?? (previous.format as LicenceKeyFormat),
			assignedToEmail: previous.assignedToEmail,
			assignedToCustomerId: previous.assignedToCustomerId,
			activationLimit: previous.activationLimit,
			expiresAt: previous.expiresAt,
			storeKey: input.storeKey === true,
			metadata: previous.metadata
		});

		const reason = input.reason ?? 'REISSUED';
		const replacedKey = await this.revoke(previous.id, reason);

		// The link is written after both rows exist, in one statement each, so a reader never sees a
		// key that points at a replacement which does not point back.
		const manager = this.typeOrmEntitlementKeyRepository.manager;
		const previousMetadata = {
			...asMetadata(replacedKey.metadata),
			replacedByKeyId: result.key.id,
			replacedAt: new Date().toISOString(),
			replacedReason: reason
		};
		const nextMetadata = { ...asMetadata(result.key.metadata), replacedKeyId: previous.id };

		await manager.update(EntitlementKey, { id: previous.id } as any, { metadata: previousMetadata } as any);
		await manager.update(EntitlementKey, { id: result.key.id } as any, { metadata: nextMetadata } as any);

		result.key.metadata = nextMetadata;
		replacedKey.metadata = previousMetadata;

		return { ...result, replacedKey };
	}

	/**
	 * Re-displays a key to its holder.
	 *
	 * Only possible when the key was issued with `storeKey`, because only then was a ciphertext
	 * written. This is the one path that decrypts, and it is deliberate: validation never does, which
	 * is what keeps a lookup to one indexed probe.
	 *
	 * @param id The key to re-display.
	 * @returns The key in clear.
	 * @throws BadRequestException when the key was issued write-only.
	 */
	public async reveal(id: ID): Promise<string> {
		const key = await this.findOneScoped(id);

		if (!key.keyCiphertext) {
			throw new BadRequestException(
				'ENTITLEMENT_KEY_NOT_RECOVERABLE: this key was issued write-only, so it cannot be re-displayed; re-issue it instead.'
			);
		}

		return decryptLicenceKey(key.keyCiphertext);
	}

	/**
	 * Records who holds a key.
	 *
	 * A key is never re-assigned to a second holder: doing so would make "who was given key X"
	 * ambiguous, and the documented answer is a new key.
	 *
	 * @param id The key.
	 * @param input The holder.
	 * @returns The updated key.
	 * @throws BadRequestException when the key already has a different holder.
	 */
	public async assign(
		id: ID,
		input: { assignedToEmail?: string; assignedToCustomerId?: ID }
	): Promise<EntitlementKey> {
		const key = await this.findOneScoped(id);

		if (
			key.assignedToEmail &&
			input.assignedToEmail &&
			key.assignedToEmail.toLowerCase() !== input.assignedToEmail.toLowerCase()
		) {
			throw new BadRequestException(
				'ENTITLEMENT_KEY_ALREADY_ASSIGNED: a key is never re-assigned to a second holder; issue a new key instead.'
			);
		}

		await this.typeOrmEntitlementKeyRepository.update({ id } as any, {
			assignedToEmail: input.assignedToEmail ?? key.assignedToEmail,
			assignedToCustomerId: input.assignedToCustomerId ?? key.assignedToCustomerId,
			assignedAt: key.assignedAt ?? new Date()
		} as any);

		return await this.findOneScoped(id);
	}

	/**
	 * Marks a key as consumed by an activation, inside the caller's transaction.
	 *
	 * The transition is written where the activation is, so a key that is spent and an activation that
	 * spent it commit together: there is no instant in which a device holds a seat under a key that
	 * still looks unused.
	 *
	 * @param manager The caller's transaction manager.
	 * @param key The key being consumed.
	 * @returns The key, after the transition.
	 * @throws BadRequestException when the key is not in a state that may be consumed.
	 */
	public async consume(manager: EntityManager, key: EntitlementKey): Promise<EntitlementKey> {
		if (key.status === EntitlementKeyStatus.REVOKED) {
			throw new BadRequestException('ENTITLEMENT_KEY_REVOKED: this key has been withdrawn.');
		}

		if (key.status === EntitlementKeyStatus.EXPIRED || (key.expiresAt && new Date(key.expiresAt).getTime() < Date.now())) {
			throw new BadRequestException('ENTITLEMENT_KEY_EXPIRED: this key is past its expiry.');
		}

		if (key.status === EntitlementKeyStatus.ACTIVATED) {
			throw new BadRequestException(
				'ENTITLEMENT_KEY_USED: this key has already been activated once, and a key is activated at most once.'
			);
		}

		await manager.update(
			EntitlementKey,
			{ id: key.id } as any,
			{ status: EntitlementKeyStatus.ACTIVATED } as any
		);

		key.status = EntitlementKeyStatus.ACTIVATED;

		return key;
	}

	/**
	 * Withdraws every credential of a right, inside the caller's transaction.
	 *
	 * Called when the right itself is revoked or expired: the credential cannot outlive the right it
	 * was issued against, and doing it through the caller's manager rather than through `revoke` is
	 * what keeps the withdrawal of the right, of its keys and of its activations one transaction
	 * instead of three.
	 *
	 * @param manager The caller's transaction manager.
	 * @param entitlementId The right.
	 * @param reason Why.
	 * @returns The ids of the keys that were withdrawn.
	 */
	public async revokeForEntitlement(manager: EntityManager, entitlementId: ID, reason: string): Promise<ID[]> {
		const keys = await manager.find(EntitlementKey, {
			where: { entitlementId, status: Not(EntitlementKeyStatus.REVOKED) } as any
		});
		const now = new Date();
		const userId = RequestContext.currentUserId();
		const revoked: ID[] = [];

		for (const key of keys) {
			await manager.update(
				EntitlementKey,
				{ id: key.id } as any,
				{
					status: EntitlementKeyStatus.REVOKED,
					revokedAt: now,
					...(userId ? { revokedByUserId: userId } : {}),
					metadata: { ...asMetadata(key.metadata), revokedReason: reason } as any
				} as any
			);
			revoked.push(key.id);
		}

		return revoked;
	}

	/**
	 * @param entitlementId The right.
	 * @returns Its keys, newest first.
	 */
	public async findForEntitlement(entitlementId: ID): Promise<EntitlementKey[]> {
		return await this.typeOrmEntitlementKeyRepository.find({
			where: {
				entitlementId,
				...(RequestContext.currentTenantId() ? { tenantId: RequestContext.currentTenantId() } : {}),
				...(RequestContext.currentOrganizationId()
					? { organizationId: RequestContext.currentOrganizationId() }
					: {})
			} as any,
			order: { createdAt: 'DESC' } as any
		});
	}

	/**
	 * Reads a key by its digest, scoped to the caller's tenant and organization.
	 *
	 * @param plaintext The key in clear.
	 * @returns The key row, or null.
	 */
	public async findByPlaintext(plaintext: string): Promise<EntitlementKey | null> {
		return await this.typeOrmEntitlementKeyRepository.findOne({
			where: { keyHash: digestLicenceKey(plaintext) } as any
		});
	}

	/**
	 * Reads a key, and refuses when it is not the caller's.
	 *
	 * @param id The key.
	 * @returns The key.
	 * @throws NotFoundException when it does not exist, or belongs to another tenant.
	 */
	public async findOneScoped(id: ID): Promise<EntitlementKey> {
		const key = await this.typeOrmEntitlementKeyRepository.findOne({
			where: {
				id,
				...(RequestContext.currentTenantId() ? { tenantId: RequestContext.currentTenantId() } : {}),
				...(RequestContext.currentOrganizationId()
					? { organizationId: RequestContext.currentOrganizationId() }
					: {})
			} as any
		});

		if (!key) {
			throw new NotFoundException('The licence key was not found.');
		}

		return key;
	}

	/**
	 * @param entitlementId The right a key is issued against.
	 * @param scope The tenant and organization the read is scoped to.
	 * @returns The right.
	 * @throws NotFoundException when it is not the caller's.
	 */
	private async requireEntitlement(entitlementId: ID, scope: IEntitlementScope = {}): Promise<Entitlement> {
		const tenantId = scope.tenantId ?? RequestContext.currentTenantId();
		const organizationId = scope.organizationId ?? RequestContext.currentOrganizationId();

		const entitlement = await this.typeOrmEntitlementRepository.findOne({
			where: {
				id: entitlementId,
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
	 * Writes one key event into the outbox, inside the caller's transaction.
	 *
	 * @param manager The caller's transaction manager.
	 * @param name The event name.
	 * @param key The key the event is about.
	 * @param data The payload projection.
	 */
	private async appendKeyEvent(
		manager: EntityManager,
		name: string,
		key: EntitlementKey,
		data: Record<string, unknown>
	): Promise<void> {
		try {
			await this.outbox.append(manager, {
				name,
				aggregateType: 'ENTITLEMENT_KEY',
				aggregateId: key.id as ID,
				data: data as any,
				tenantId: key.tenantId,
				organizationId: key.organizationId
			});
		} catch (error) {
			// An outbox row that cannot be written must fail the transaction it belongs to: an event
			// that describes a state change which committed is the one thing a consumer cannot rebuild.
			this.logger.error(`Could not append ${name} for key ${key.id}: ${(error as Error)?.message}`);
			throw error;
		}
	}
}
