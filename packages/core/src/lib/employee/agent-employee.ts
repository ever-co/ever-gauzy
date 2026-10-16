import { randomUUID } from 'node:crypto';
import { EntityManager, EntityTarget, FindOptionsWhere, ObjectLiteral } from 'typeorm';
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

/**
 * Reads one row inside the caller's transaction and, on Postgres and MySQL, locks it for the rest of the
 * transaction (`SELECT … FOR UPDATE`), so that two transactions doing the same check-then-insert run one
 * after the other: the second waits for the first to commit, then sees its rows. SQLite has no row locks;
 * it allows one writer at a time, so the embedded dialect reads the row as is.
 *
 * @param manager The transaction manager.
 * @param entity The entity to read.
 * @param where The row to read.
 * @returns The row, or `null`.
 */
export async function findOneForUpdate<T extends ObjectLiteral>(
	manager: EntityManager,
	entity: EntityTarget<T>,
	where: FindOptionsWhere<T>
): Promise<T | null> {
	const type = manager.connection?.options?.type;
	const locks = type === 'postgres' || type === 'mysql' || type === 'mariadb';
	return await manager.findOne(entity, { where, ...(locks ? { lock: { mode: 'pessimistic_write' as const } } : {}) });
}
