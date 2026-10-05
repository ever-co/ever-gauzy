import { createHmac, timingSafeEqual } from 'crypto';
import { environment } from '@gauzy/config';

/**
 * A short-lived, signed statement that the GitHub user who completed an install flow is entitled to a
 * specific installation (GHSA-4rwq-65wh-45h4).
 *
 * The post-install callback exchanges GitHub's OAuth code the moment it arrives (so the code is spent
 * and cannot be replayed), checks entitlement, and hands the browser only this proof — never the code.
 * The proof is bound to the flow's `state` nonce, which is bound to the tenant that started the flow,
 * and `POST /install` consumes that nonce: a proof is good for one bind, in one tenant, for 10 minutes.
 * Stateless: nothing is written back to the nonce.
 */
const PROOF_TTL_MS = 10 * 60 * 1000;
const PROOF_PATTERN = /^(\d{13})\.([a-f0-9]{64})$/;

function proofKey(): Buffer {
	// A key derived for this one purpose, so a proof is never interchangeable with a JWT.
	return createHmac('sha256', String(environment.JWT_SECRET ?? '')).update('gauzy:github-install-proof:v1').digest();
}

function signature(state: string, installationId: string, expiresAt: number): string {
	return createHmac('sha256', proofKey()).update(`${state}\n${installationId}\n${expiresAt}`).digest('hex');
}

/** Issues a proof that the flow `state` may bind `installationId`. */
export function signGithubInstallProof(state: string, installationId: string, now: number = Date.now()): string {
	const expiresAt = now + PROOF_TTL_MS;
	return `${expiresAt}.${signature(state, installationId, expiresAt)}`;
}

/** Whether `proof` was issued for exactly this flow and installation, and has not expired. */
export function isGithubInstallProofValid(
	proof: unknown,
	state: string,
	installationId: string,
	now: number = Date.now()
): boolean {
	const match = typeof proof === 'string' ? PROOF_PATTERN.exec(proof) : null;
	if (!match || !state || !installationId) {
		return false;
	}
	const expiresAt = Number(match[1]);
	if (!Number.isSafeInteger(expiresAt) || expiresAt <= now || expiresAt > now + PROOF_TTL_MS) {
		return false;
	}
	const expected = Buffer.from(signature(state, installationId, expiresAt), 'hex');
	return timingSafeEqual(expected, Buffer.from(match[2], 'hex'));
}
