// Must stay first: loads the entity graph before the billing helpers pull an entity (see activity.controller.spec.ts).
import '../core/entities/internal';

import { assertFinalStatusKept, INVOICE_REJECTED_IS_FINAL, INVOICE_VOID_IS_FINAL } from './invoice-final-status';

/**
 * A void invoice or a rejected estimate releases the time its lines bill. The refusal to make it live again exists
 * for the case that charges twice: another document billing that time since. Refused for every void or rejected
 * document, it took away what every installation could do with the many that released time nobody billed again.
 */
describe('assertFinalStatusKept', () => {
	const billedAgain = new Date('2026-11-02T10:00:00.000Z');

	it.each(['DRAFT', 'SENT', 'FULLY_PAID', 'REJECTED'])(
		'lets a void document whose released time no other document bills move to %s',
		(status) => {
			expect(() => assertFinalStatusKept({ status: 'VOID', releasedTimeBilledAt: null }, status)).not.toThrow();
		}
	);

	it.each(['DRAFT', 'SENT', 'FULLY_PAID', 'REJECTED'])(
		'keeps a void document whose released time another document bills from moving to %s',
		(status) => {
			const stored = { status: 'VOID', releasedTimeBilledAt: billedAgain };

			expect(() => assertFinalStatusKept(stored, status)).toThrow(INVOICE_VOID_IS_FINAL);
		}
	);

	it.each(['ACCEPTED', 'SENT', 'DRAFT'])(
		'lets a rejected estimate whose released time no other document bills move to %s',
		(status) => {
			expect(() => assertFinalStatusKept({ status: 'REJECTED' }, status)).not.toThrow();
		}
	);

	it.each(['ACCEPTED', 'SENT', 'DRAFT'])(
		'keeps a rejected estimate whose released time another document bills from moving to %s',
		(status) => {
			const stored = { status: 'REJECTED', releasedTimeBilledAt: billedAgain };

			expect(() => assertFinalStatusKept(stored, status)).toThrow(INVOICE_REJECTED_IS_FINAL);
		}
	);

	it.each([
		['states no status', undefined],
		['states VOID', 'VOID'],
		['keeps it rejected', 'REJECTED']
	])('lets a change of a document whose released time another one bills through when it %s', (_label, status) => {
		const stored = { status: 'REJECTED', releasedTimeBilledAt: billedAgain };

		expect(() => assertFinalStatusKept(stored, status)).not.toThrow();
	});
});
