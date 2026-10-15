import { randomUUID } from 'node:crypto';
import { EmployeeKindEnum } from '@gauzy/contracts';

/**
 * The domain an agent employee's login identity defaults to. Under the RFC 2606 `.invalid` top-level
 * domain, which is guaranteed never to resolve, so nothing — no welcome mail, no password reset, no
 * sign-in code — can ever be delivered to an agent.
 */
export const DEFAULT_AGENT_EMAIL_DOMAIN = 'agents.invalid';

/** A syntactically valid address whose domain ends in the reserved `.invalid` top-level domain. */
const AGENT_EMAIL_PATTERN = /^[a-z0-9._%+-]+@([a-z0-9-]+\.)+invalid$/;

/**
 * Whether an address may be an agent's login identity: a well-formed address under the reserved
 * `.invalid` top-level domain, so it can never receive mail. An agent with a deliverable address could
 * have a password set through the reset flow by whoever reads that mailbox, and then sign in as the agent.
 *
 * @param email The address, already trimmed and lower-cased.
 */
export function isAgentEmail(email: string): boolean {
	return typeof email === 'string' && email.length <= 254 && AGENT_EMAIL_PATTERN.test(email);
}

/**
 * The address an agent gets when its integration names none: `agent-<random id>@agents.invalid`.
 */
export function defaultAgentEmail(): string {
	return `agent-${randomUUID()}@${DEFAULT_AGENT_EMAIL_DOMAIN}`;
}

/**
 * Whether a value names an employee kind (`human` or `agent`). Used to accept a `kind` filter from a query
 * string only when it is one of the two.
 */
export function isEmployeeKind(value: unknown): value is EmployeeKindEnum {
	return value === EmployeeKindEnum.HUMAN || value === EmployeeKindEnum.AGENT;
}
