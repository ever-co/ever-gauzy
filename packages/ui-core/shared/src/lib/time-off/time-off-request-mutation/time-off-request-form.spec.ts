import { IOrganizationDocument, TimeOffRequestFormTypeEnum } from '@gauzy/contracts';
import { findTimeOffRequestForm } from './time-off-request-form';

/**
 * The request form behind the "Download paid / unpaid request form" buttons (ever-co/ever-gauzy#5481): found by the
 * document's name, not by its place in the organization's document list, which the dialog used to read as "the
 * first is the paid form, the second the unpaid one".
 */
describe('findTimeOffRequestForm', () => {
	const { PAID, UNPAID } = TimeOffRequestFormTypeEnum;

	const document = (name: string, documentUrl: string, extra: Partial<IOrganizationDocument> = {}) =>
		({ id: `${name}@${documentUrl}`, name, documentUrl, ...extra }) as IOrganizationDocument;

	const handbook = document('Employee Handbook', 'https://files.test/handbook.pdf');
	const paid = document('Paid Days off Request', 'https://files.test/paid.pdf');
	const unpaid = document('Unpaid Days off Request', 'https://files.test/unpaid.pdf');

	it('finds each form by name, whatever the order of the list', () => {
		for (const documents of [
			[paid, unpaid],
			[unpaid, paid],
			[handbook, unpaid, paid],
			[unpaid, handbook, paid]
		]) {
			expect(findTimeOffRequestForm(documents, PAID)).toBe(paid);
			expect(findTimeOffRequestForm(documents, UNPAID)).toBe(unpaid);
		}
	});

	it('answers null when the organization has no document of that name, rather than another document', () => {
		expect(findTimeOffRequestForm([handbook, unpaid], PAID)).toBeNull();
		expect(findTimeOffRequestForm([handbook], UNPAID)).toBeNull();
		expect(findTimeOffRequestForm([], PAID)).toBeNull();
		expect(findTimeOffRequestForm(undefined, PAID)).toBeNull();
	});

	it('does not take the unpaid form for the paid one, or a name that only contains it', () => {
		const lookalike = document('Paid Days off Request (old)', 'https://files.test/old.pdf');

		expect(findTimeOffRequestForm([unpaid, lookalike], PAID)).toBeNull();
	});

	it('reads the name without case or extra spaces', () => {
		const typed = document('  paid  days OFF request ', 'https://files.test/typed.pdf');

		expect(findTimeOffRequestForm([handbook, typed], PAID)).toBe(typed);
	});

	it('leaves out a document of that name without a link', () => {
		const blank = document('Paid Days off Request', '  ');

		expect(findTimeOffRequestForm([blank], PAID)).toBeNull();
		expect(findTimeOffRequestForm([blank, paid], PAID)).toBe(paid);
	});

	it('takes the most recently saved one when several carry the name, else the first listed', () => {
		const older = document('Paid Days off Request', 'https://files.test/2025.pdf', {
			createdAt: new Date('2025-01-10T00:00:00.000Z')
		});
		const newer = document('Paid Days off Request', 'https://files.test/2026.pdf', {
			createdAt: new Date('2025-01-10T00:00:00.000Z'),
			updatedAt: new Date('2026-03-01T00:00:00.000Z')
		});
		const undated = document('Paid Days off Request', 'https://files.test/undated.pdf');

		expect(findTimeOffRequestForm([older, newer], PAID)).toBe(newer);
		expect(findTimeOffRequestForm([newer, older], PAID)).toBe(newer);
		expect(findTimeOffRequestForm([undated, paid], PAID)).toBe(undated);
	});

	it('prefers an older form it can download to a newer one whose link is not http(s)', () => {
		const older = document('Paid Days off Request', 'https://files.test/2025.pdf', {
			createdAt: new Date('2025-01-10T00:00:00.000Z')
		});
		const newer = document('Paid Days off Request', 'javascript:alert(1)', {
			createdAt: new Date('2026-03-01T00:00:00.000Z')
		});

		expect(findTimeOffRequestForm([newer, older], PAID)).toBe(older);
		expect(findTimeOffRequestForm([older, newer], PAID)).toBe(older);
	});

	it('still answers the form when its only link is not http(s), so the dialog can say it cannot be downloaded', () => {
		const unusable = document('Paid Days off Request', 'ftp://files.test/paid.pdf');

		expect(findTimeOffRequestForm([handbook, unusable], PAID)).toBe(unusable);
	});
});
