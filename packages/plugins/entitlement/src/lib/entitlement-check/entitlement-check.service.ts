import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { RequestContext, RuleService } from '@gauzy/core';
import { Entitlement } from '../entitlement/entitlement.entity';
import { EntitlementKey } from '../entitlement-key/entitlement-key.entity';
import { digestLicenceKey } from '../entitlement-key/licence-key';
import { TypeOrmEntitlementRepository } from '../entitlement/repository/type-orm-entitlement.repository';
import { TypeOrmEntitlementKeyRepository } from '../entitlement-key/repository/type-orm-entitlement-key.repository';
import { TypeOrmEntitlementActivationRepository } from '../entitlement-activation/repository/type-orm-entitlement-activation.repository';
import { EntitlementActivationStatus, EntitlementKeyStatus } from '../entitlement.enums';
import { EntitlementCheckReason, IEntitlementCheckInput, IEntitlementCheckResult } from '../entitlement.types';
import { buildEntitlementContext, ENTITLEMENT_RULE_OWNER } from '../entitlement-conditions';
import { entitlementTermEnd, evaluateEntitlementState, remainingQuantity } from './entitlement-rules';

/**
 * The entitlement check: the one question every consumer asks, answered from one implementation.
 *
 * The answer is derived — from the state, the term and the seats in use — and never from a stored
 * "is entitled" flag, because a flag is a second copy of those three facts and the copy is the one
 * that goes stale. A denial names which of the conditions failed, and it is answered rather than
 * hidden: a caller has to be able to tell "you may not" from "there is no such right" from "the
 * licensing service is unreachable", and only the last of those is an error.
 *
 * This class is what another package gates on. It is exported from the plugin's barrel together
 * with `EntitlementRequiredGuard`, so a consumer never reaches for a repository or an internal
 * class to ask whether a customer is entitled to something.
 */
@Injectable()
export class EntitlementCheckService {
	constructor(
		readonly typeOrmEntitlementRepository: TypeOrmEntitlementRepository,
		readonly typeOrmEntitlementKeyRepository: TypeOrmEntitlementKeyRepository,
		readonly typeOrmEntitlementActivationRepository: TypeOrmEntitlementActivationRepository,
		private readonly ruleService: RuleService
	) {}

	/**
	 * Answers whether a right may be exercised.
	 *
	 * @param input What the caller holds: a key, or the identity of a right.
	 * @returns The verdict and the code that explains it. A denial is a normal answer, not an error:
	 * only a request that names neither a key nor a right is refused outright.
	 */
	public async check(input: IEntitlementCheckInput): Promise<IEntitlementCheckResult> {
		if (!input?.key && !input?.entitlementId) {
			return {
				allowed: false,
				reason: EntitlementCheckReason.REFERENCE_REQUIRED,
				conditionsMatched: true
			};
		}

		const key = input.key ? await this.findKeyByDigest(input.key) : null;

		if (input.key && !key) {
			return { allowed: false, reason: EntitlementCheckReason.KEY_NOT_FOUND, conditionsMatched: true };
		}

		// A key and a right that do not belong together is a caller mistake, and it is refused as one
		// rather than answered from whichever of the two happened to be named first: answering would
		// let a caller probe a right it does not hold a credential for.
		if (key && input.entitlementId && key.entitlementId !== input.entitlementId) {
			return { allowed: false, reason: EntitlementCheckReason.KEY_NOT_FOUND, conditionsMatched: true };
		}

		const entitlementId = input.entitlementId ?? key?.entitlementId;

		if (!entitlementId) {
			return { allowed: false, reason: EntitlementCheckReason.NOT_FOUND, conditionsMatched: true };
		}

		const entitlement = await this.findOneScoped(entitlementId);

		if (!entitlement) {
			// A right of another tenant is reported exactly like one that does not exist, so the check
			// cannot be used to enumerate another organization's licences.
			return { allowed: false, reason: EntitlementCheckReason.NOT_FOUND, conditionsMatched: true };
		}

		return await this.evaluate(entitlement, key, input);
	}

	/**
	 * Answers whether a right may be exercised, and refuses with a stable code when it may not.
	 *
	 * The activation path uses this rather than re-deriving the verdict, so a refusal and the answer
	 * the check endpoint gives are literally the same decision.
	 *
	 * @param input What the caller holds.
	 * @returns The verdict.
	 * @throws ForbiddenException when the right may not be exercised, carrying the stable code as its
	 * message so a caller in another package can branch on it.
	 */
	public async assertEntitled(input: IEntitlementCheckInput): Promise<IEntitlementCheckResult> {
		const result = await this.check(input);

		if (!result.allowed) {
			throw new ForbiddenException(result.reason);
		}

		return result;
	}

	/**
	 * Derives the verdict for a right that has already been read.
	 *
	 * @param entitlement The right.
	 * @param key The key the caller presented, when one was.
	 * @param input The original request, for the device, the seat and the caller's context.
	 * @returns The verdict.
	 */
	public async evaluate(
		entitlement: Entitlement,
		key: EntitlementKey | null,
		input: IEntitlementCheckInput = {}
	): Promise<IEntitlementCheckResult> {
		const now = new Date();
		const live = await this.typeOrmEntitlementActivationRepository.count({
			where: {
				entitlementId: entitlement.id,
				status: EntitlementActivationStatus.ACTIVE
			} as any
		});
		const occupancy = { liveActivations: live };

		// The credential is answered first: a revoked key is not a key, whatever state the right it
		// was issued against is in, and reporting the right's state instead would let a withdrawn
		// credential read as "come back later".
		const keyVerdict = this.evaluateKey(key, now);

		if (keyVerdict) {
			return {
				...keyVerdict,
				entitlementId: entitlement.id,
				kind: entitlement.kind,
				status: entitlement.status,
				remainingQuantity: remainingQuantity(entitlement, occupancy),
				validUntil: entitlementTermEnd(entitlement, now),
				conditionsMatched: true
			};
		}

		const stateVerdict = evaluateEntitlementState(entitlement, occupancy, now);

		if (!stateVerdict.allowed) {
			return {
				allowed: false,
				reason: stateVerdict.reason,
				entitlementId: entitlement.id,
				kind: entitlement.kind,
				status: entitlement.status,
				remainingQuantity: remainingQuantity(entitlement, occupancy),
				validUntil: entitlementTermEnd(entitlement, now),
				conditionsMatched: true
			};
		}

		// Conditions come last because they are the only part that has to read another table, and
		// because a right that is withdrawn is withdrawn regardless of what its conditions say.
		const conditions = await this.evaluateConditions(entitlement, input, {
			liveActivations: live,
			deviceId: input.deviceId,
			seatReference: input.seatReference
		});

		return {
			allowed: conditions.matched,
			reason: conditions.matched ? EntitlementCheckReason.ALLOWED : EntitlementCheckReason.CONDITIONS_NOT_MET,
			entitlementId: entitlement.id,
			kind: entitlement.kind,
			status: entitlement.status,
			remainingQuantity: remainingQuantity(entitlement, occupancy),
			validUntil: entitlementTermEnd(entitlement, now),
			conditionsMatched: conditions.matched,
			failedRules: conditions.failedRules,
			unresolvedAttributes: conditions.unresolvedAttributes
		};
	}

	/**
	 * Evaluates the `rule` rows attached to a right.
	 *
	 * @param entitlement The right.
	 * @param input The original request, whose `context` is merged over the derived one.
	 * @param extra Attributes about the attempt itself, which a condition may read.
	 * @returns Whether the conditions matched, and the trace that explains the verdict.
	 */
	public async evaluateConditions(
		entitlement: Entitlement,
		input: IEntitlementCheckInput = {},
		extra: Record<string, unknown> = {}
	): Promise<{ matched: boolean; failedRules: string[]; unresolvedAttributes: string[] }> {
		const rules = await this.ruleService.findByOwner(ENTITLEMENT_RULE_OWNER, entitlement.id);

		// No conditions is not "no answer": an owner that has configured none is unrestricted, which
		// is what the evaluator already says about an empty set.
		if (!rules.length) {
			return { matched: true, failedRules: [], unresolvedAttributes: [] };
		}

		const context = buildEntitlementContext(entitlement, {
			...extra,
			...(input.context ?? {})
		});

		const result = this.ruleService.evaluateRules(rules, context, { includeInactive: false });

		return {
			matched: result.matched,
			failedRules: result.failedRules,
			unresolvedAttributes: [...result.unresolvedAttributes, ...result.coercionFailures]
		};
	}

	/**
	 * Reads a right by identifier, scoped to the caller's tenant and organization.
	 *
	 * @param id The right.
	 * @returns The right, or null when it is not the caller's.
	 */
	public async findOneScoped(id: ID): Promise<Entitlement | null> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		return await this.typeOrmEntitlementRepository.findOne({
			where: {
				id,
				...(tenantId ? { tenantId } : {}),
				...(organizationId ? { organizationId } : {})
			} as any
		});
	}

	/**
	 * Reads a right by identifier, and refuses when it is not the caller's.
	 *
	 * @param id The right.
	 * @returns The right.
	 * @throws NotFoundException when it does not exist, or belongs to another tenant.
	 */
	public async findOneScopedOrFail(id: ID): Promise<Entitlement> {
		const entitlement = await this.findOneScoped(id);

		if (!entitlement) {
			throw new NotFoundException('The entitlement was not found.');
		}

		return entitlement;
	}

	/**
	 * Finds a key by the digest of its plaintext: one indexed probe, never a scan and never a
	 * decryption.
	 *
	 * @param plaintext The key the caller presented.
	 * @returns The key row, or null when this organization issued none with that digest.
	 */
	public async findKeyByDigest(plaintext: string): Promise<EntitlementKey | null> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		return await this.typeOrmEntitlementKeyRepository.findOne({
			where: {
				keyHash: digestLicenceKey(plaintext),
				...(tenantId ? { tenantId } : {}),
				...(organizationId ? { organizationId } : {})
			} as any
		});
	}

	/**
	 * @param key The key the caller presented, when one was.
	 * @param now The instant of the question.
	 * @returns The verdict the credential alone decides, or null when the credential is usable.
	 */
	private evaluateKey(
		key: EntitlementKey | null,
		now: Date
	): { allowed: false; reason: (typeof EntitlementCheckReason)[keyof typeof EntitlementCheckReason] } | null {
		if (!key) {
			return null;
		}

		if (key.status === EntitlementKeyStatus.REVOKED) {
			return { allowed: false, reason: EntitlementCheckReason.KEY_REVOKED };
		}

		if (key.status === EntitlementKeyStatus.EXPIRED) {
			return { allowed: false, reason: EntitlementCheckReason.KEY_EXPIRED };
		}

		if (key.expiresAt && new Date(key.expiresAt).getTime() < now.getTime()) {
			return { allowed: false, reason: EntitlementCheckReason.KEY_EXPIRED };
		}

		return null;
	}
}
