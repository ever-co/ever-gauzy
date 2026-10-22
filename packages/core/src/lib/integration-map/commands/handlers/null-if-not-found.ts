import { NotFoundException } from '@nestjs/common';

/**
 * For the `.catch()` of a lookup: a miss (`NotFoundException`) is `null`, any other error is rethrown. A failed
 * lookup (a timeout, a lost connection) must not be read as "not mapped yet", or the sync creates a duplicate.
 */
export function nullIfNotFound(error: unknown): null {
	if (error instanceof NotFoundException) {
		return null;
	}
	throw error;
}
