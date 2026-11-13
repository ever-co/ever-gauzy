import { ID, IInvoice, IUser } from '@gauzy/contracts';
import { IEstimateAnswer } from './estimate-answered.event';

/** The parts of an estimate its answer's notice and email read. */
export type IAnsweredEstimate = Pick<IInvoice, 'id' | 'invoiceNumber' | 'totalValue' | 'currency' | 'toContact'>;

/** The client's name, or null when the estimate's contact has none. */
export function clientNameOf(estimate: Pick<IInvoice, 'toContact'>): string | null {
	const name = estimate.toContact?.name?.trim();
	return name || null;
}

/**
 * An estimate's total with two decimals, grouped the way `languageCode` writes numbers, or null when the estimate
 * states none. The currency is not part of it: the email and the notice put it beside the amount.
 */
export function formattedAmountOf(totalValue: number | string | null | undefined, languageCode = 'en'): string | null {
	if (totalValue === null || totalValue === undefined || totalValue === '') {
		return null;
	}
	const value = Number(totalValue);
	if (!Number.isFinite(value)) {
		return null;
	}
	try {
		return new Intl.NumberFormat(languageCode, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
			value
		);
	} catch {
		// A language the runtime cannot format in
		return value.toFixed(2);
	}
}

/**
 * The in-app notice of a client's answer: who answered which estimate, its total, the address that answered and what
 * comes next. In English, like the platform's other notices.
 */
export function estimateAnswerNotice(
	estimate: IAnsweredEstimate,
	answer: Pick<IEstimateAnswer, 'isAccepted' | 'answeredFrom'>
): { title: string; message: string } {
	const client = clientNameOf(estimate) ?? 'Your client';
	const answered = answer.isAccepted ? 'accepted' : 'declined';
	const title = `${client} ${answered} estimate #${estimate.invoiceNumber}`;

	const sentences: string[] = [];
	const amount = formattedAmountOf(estimate.totalValue);
	if (amount) {
		const total = [amount, estimate.currency].filter(Boolean).join(' ');
		sentences.push(`Total: ${total}.`);
	}
	if (answer.answeredFrom) {
		sentences.push(`Answered from ${answer.answeredFrom}.`);
	}
	const nextStep = answer.isAccepted
		? 'You can now turn it into an invoice.'
		: 'You can follow up with the client or send a revised estimate.';
	sentences.push(nextStep);

	return { title, message: sentences.join(' ') };
}

/**
 * Whether the estimate's creator is emailed the answer (`estimate-answered`). Not without an active account with an
 * address. Nor when the Inbox emails notifications and they are among those notified in-app: the Inbox's email of that
 * notification tells them, at the time and in the way their notification settings ask, so they never get both.
 *
 * @param creator - The user who created the estimate, if known.
 * @param notifiedUserIds - The users of the employees notified in-app.
 * @param inboxEmailsNotifications - Whether the Inbox emails notifications in this installation.
 */
export function emailsCreator(
	creator: Pick<IUser, 'id' | 'email' | 'isActive'> | null | undefined,
	notifiedUserIds: ReadonlyArray<ID>,
	inboxEmailsNotifications: boolean
): boolean {
	const hasAddress = Boolean(creator?.email?.trim());
	const isActive = creator?.isActive !== false;
	if (!hasAddress || !isActive) {
		return false;
	}
	const isNotifiedInApp = notifiedUserIds.includes(creator.id);
	return !(inboxEmailsNotifications && isNotifiedInApp);
}
