import { FlushMode } from '@mikro-orm/core';
import { ID } from '@gauzy/contracts';
import { Organization } from '../core/entities/internal';
import { MultiORM, MultiORMEnum } from '../core/utils';
import {
	MikroOrmEntityManager,
	MultiOrmEntityManager,
	TypeOrmEntityManager
} from '../core/entities/subscribers/entity-event-subscriber.types';

/**
 * Issue #9872 — when the platform sets an employee's screen capture itself, it follows the organization's setting
 * at that moment.
 *
 * The desktop apps decide on the employee flag: the Agent reads only it, and the Timer captures when it is on
 * whatever the organization says (`allowScreenshotCapture()` in `desktop-lib`). With the employee column defaulting
 * to `true`, and starting work setting it to `true`, an organization with capture off still captured as soon as it
 * had working employees. So:
 *
 * - a new employee starts with its organization's value, unless the write states one;
 * - starting or resuming work turns capture on only where the organization allows it (ending work still turns it
 *   off).
 *
 * A stored value is never rewritten outside those two moments, and the desktop logic is unchanged.
 */

/**
 * The screen capture value to store when the platform sets it: on creation, or when work starts or resumes.
 *
 * @param requested the value the write carried, before any hook changed it. A stated value (anything but
 *   `undefined`/`null`, including an imported `"1"`) keeps today's behaviour.
 * @param current the value after the subscriber's work-status rule: `true` when the write starts work, `false` when
 *   it ends it, else unset
 * @param organizationAllows the organization's `allowScreenshotCapture`; `undefined`/`null` when it could not be read
 * @returns the value to store
 */
export function screenshotCaptureFromOrganization(
	requested: unknown,
	current: boolean | undefined,
	organizationAllows: boolean | null | undefined
): boolean | undefined {
	if (requested !== undefined && requested !== null) {
		return current;
	}
	if (typeof organizationAllows !== 'boolean') {
		return current;
	}
	// An employee whose work has ended has capture off, as before; otherwise the organization decides.
	return current !== false && organizationAllows;
}

/**
 * Reads an organization's `allowScreenshotCapture` with the write's own entity manager (so inside its transaction).
 *
 * @returns the stored value, or `undefined` when the organization is not found or the manager does not match the ORM
 */
export async function readOrganizationScreenshotCapture(
	em: MultiOrmEntityManager | undefined,
	organizationId: ID,
	tenantId: ID | undefined,
	ormType: MultiORM
): Promise<boolean | undefined> {
	const where = { id: organizationId, ...(tenantId ? { tenantId } : {}) };
	let organization: Pick<Organization, 'allowScreenshotCapture'> | null = null;

	switch (ormType) {
		case MultiORMEnum.TypeORM:
			if (em instanceof TypeOrmEntityManager) {
				organization = await em.findOne(Organization, {
					where,
					select: { id: true, allowScreenshotCapture: true }
				});
			}
			break;
		case MultiORMEnum.MikroORM:
			if (em instanceof MikroOrmEntityManager) {
				// Called from a flush hook: never auto-flush from here.
				organization = await em.findOne(Organization, where, { flushMode: FlushMode.COMMIT });
			}
			break;
	}

	return toBoolean(organization?.allowScreenshotCapture);
}

/** A stored boolean as the drivers return it (`0`/`1` on SQLite and MySQL), or `undefined`. */
function toBoolean(value: unknown): boolean | undefined {
	if (typeof value === 'boolean') return value;
	if (typeof value === 'number') return value !== 0;
	return undefined;
}
