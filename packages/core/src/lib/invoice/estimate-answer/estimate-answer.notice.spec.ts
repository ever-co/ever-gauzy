import { IOrganizationContact } from '@gauzy/contracts';
import {
	IAnsweredEstimate,
	clientNameOf,
	emailsCreator,
	estimateAnswerNotice,
	formattedAmountOf
} from './estimate-answer.notice';

const estimate = (overrides: Partial<IAnsweredEstimate> = {}): IAnsweredEstimate => ({
	id: 'estimate-1',
	invoiceNumber: 12,
	totalValue: 1250,
	currency: 'USD',
	toContact: { name: 'Acme Corp' } as IOrganizationContact,
	...overrides
});

describe('the notice of a client answer to an estimate', () => {
	it('says who accepted which estimate, its total, the address that answered and what comes next', () => {
		const notice = estimateAnswerNotice(estimate(), { isAccepted: true, answeredFrom: 'billing@acme.test' });

		expect(notice).toEqual({
			title: 'Acme Corp accepted estimate #12',
			message: 'Total: 1,250.00 USD. Answered from billing@acme.test. You can now turn it into an invoice.'
		});
	});

	it('says a declined estimate can be followed up, and names no client the estimate has no name for', () => {
		const notice = estimateAnswerNotice(estimate({ toContact: { name: '  ' } as IOrganizationContact }), {
			isAccepted: false
		});

		expect(notice.title).toBe('Your client declined estimate #12');
		expect(notice.message).toBe(
			'Total: 1,250.00 USD. You can follow up with the client or send a revised estimate.'
		);
	});

	it('leaves out a total the estimate does not state', () => {
		const notice = estimateAnswerNotice(estimate({ totalValue: undefined, toContact: undefined }), {
			isAccepted: true,
			answeredFrom: null
		});

		expect(notice.message).toBe('You can now turn it into an invoice.');
	});

	it("reads the client's name off the estimate's contact", () => {
		expect(clientNameOf(estimate())).toBe('Acme Corp');
		expect(clientNameOf(estimate({ toContact: null }))).toBeNull();
	});
});

describe("an estimate's amount, as the email and the notice write it", () => {
	it('has two decimals, grouped the way the language writes numbers', () => {
		expect(formattedAmountOf(1250)).toBe('1,250.00');
		expect(formattedAmountOf('99.5')).toBe('99.50');
		// A decimal column can come back as text
		expect(formattedAmountOf('1250.456', 'en')).toBe('1,250.46');
		expect(formattedAmountOf(1250, 'ru')).toMatch(/^1\s250,00$/u);
	});

	it('is absent when the estimate states no number', () => {
		expect(formattedAmountOf(undefined)).toBeNull();
		expect(formattedAmountOf(null)).toBeNull();
		expect(formattedAmountOf('')).toBeNull();
		expect(formattedAmountOf('not a number')).toBeNull();
	});
});

describe('whether the estimate creator is emailed the answer', () => {
	const creator = { id: 'user-1', email: 'creator@org.test', isActive: true };

	it('emails an active creator with an address', () => {
		expect(emailsCreator(creator, [], false)).toBe(true);
	});

	it('emails a creator the Inbox also notifies when the Inbox emails no notification', () => {
		expect(emailsCreator(creator, ['user-1'], false)).toBe(true);
	});

	it('leaves to the Inbox a creator it notifies and emails, so they never get both', () => {
		expect(emailsCreator(creator, ['user-1'], true)).toBe(false);
	});

	it('emails a creator the Inbox does not notify, an admin with no employee profile, even where it emails', () => {
		expect(emailsCreator(creator, ['user-2'], true)).toBe(true);
	});

	it('emails nobody for an estimate with no known, active creator with an address', () => {
		expect(emailsCreator(null, [], false)).toBe(false);
		expect(emailsCreator({ ...creator, email: '' }, [], false)).toBe(false);
		expect(emailsCreator({ ...creator, isActive: false }, [], false)).toBe(false);
	});
});
