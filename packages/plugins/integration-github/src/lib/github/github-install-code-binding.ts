import { createHmac, timingSafeEqual } from 'crypto';
import { environment } from '@gauzy/config';

/**
 * Ties the OAuth `code` GitHub returns after an installation to the install flow (`state` nonce) it
 * arrived with (GHSA-4rwq-65wh-45h4).
 *
 * The code travels to the web app in the post-install URL, where it can surface in browser history or
 * an ingress log. On its own, a leaked unused code plus ANY nonce minted by the thief's own tenant was
 * enough to prove ownership of the victim's installation. The post-install callback signs the
 * (state, code) pair it received from GitHub, and `POST /install` accepts the code only with that
 * signature — so the code works solely with the flow GitHub issued it for, whose nonce is bound to the
 * tenant that started it. Stateless: nothing is written back to the nonce.
 */
const BINDING_PATTERN = /^[a-f0-9]{64}$/;

function bindingKey(): Buffer {
	// A key derived for this one purpose, so the signature is never interchangeable with a JWT.
	return createHmac('sha256', String(environment.JWT_SECRET ?? '')).update('gauzy:github-install-code-binding:v1').digest();
}

/** Signs the (state, code) pair the post-install callback received from GitHub. */
export function signGithubInstallCode(state: string, code: string): string {
	return createHmac('sha256', bindingKey()).update(`${state}\n${code}`).digest('hex');
}

/** Whether `binding` is the signature `signGithubInstallCode` produced for exactly this pair. */
export function isGithubInstallCodeBound(state: string, code: string, binding: unknown): boolean {
	if (typeof binding !== 'string' || !BINDING_PATTERN.test(binding) || !state || !code) {
		return false;
	}
	const expected = Buffer.from(signGithubInstallCode(state, code), 'hex');
	return timingSafeEqual(expected, Buffer.from(binding, 'hex'));
}
