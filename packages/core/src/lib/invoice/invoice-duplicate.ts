import { IInvoice, IInvoiceCreateInput, IInvoiceItem, IInvoiceItemCreateInput, ITag } from '@gauzy/contracts';

const DAY_MS = 24 * 60 * 60 * 1000;

/** A copy never gets a payment window longer than this, whatever the source's dates say. */
export const MAX_DUPLICATE_PAYMENT_WINDOW_DAYS = 3650;

/** What a copy of an invoice or an estimate is made of: the new number and the new date. */
export interface IInvoiceDuplicateOptions {
	/** The number the copy takes: the next one of the tenant's sequence. */
	invoiceNumber: number;
	/** The date of the copy: today. */
	today: Date;
}

/** The input a duplicate is created with: the create input, and its lines. */
export type InvoiceDuplicateInput = IInvoiceCreateInput & {
	fromOrganizationId?: string;
	toContactId?: string;
	alreadyPaid?: number;
	amountDue?: number;
	internalNote?: string;
	invoiceItems: IInvoiceItemCreateInput[];
};

/**
 * The days between the source's date and its due date: the payment window the copy keeps. A source without both
 * dates, or with a due date before its date, or with dates that are not dates, gets none; an enormous one is cut.
 */
export function paymentWindowDaysOf(source: Pick<IInvoice, 'invoiceDate' | 'dueDate'>): number {
	const from = source.invoiceDate ? new Date(source.invoiceDate).getTime() : NaN;
	const to = source.dueDate ? new Date(source.dueDate).getTime() : NaN;
	if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
		return 0;
	}
	return Math.min(MAX_DUPLICATE_PAYMENT_WINDOW_DAYS, Math.round((to - from) / DAY_MS));
}

/**
 * One line of the source as the copy's line: what is billed, how, and to whom or for what it is billed.
 *
 * The copy bills nothing the source billed: it carries no time logs (the source's lines keep billing theirs, and a
 * second line billing the same time would charge it twice) and no expense (an expense is billed by one line).
 */
function duplicateLineOf(line: IInvoiceItem): IInvoiceItemCreateInput {
	const copy: IInvoiceItemCreateInput = {
		tenantId: line.tenantId,
		organizationId: line.organizationId,
		description: line.description,
		price: line.price,
		quantity: line.quantity,
		totalValue: line.totalValue
	};
	if (line.applyTax !== undefined && line.applyTax !== null) {
		copy.applyTax = line.applyTax;
	}
	if (line.applyDiscount !== undefined && line.applyDiscount !== null) {
		copy.applyDiscount = line.applyDiscount;
	}
	for (const key of ['taskId', 'employeeId', 'projectId', 'productId'] as const) {
		const value = line[key];
		if (value) {
			copy[key] = value;
		}
	}
	return copy;
}

/**
 * Builds the draft that copies an invoice or an estimate: the same contact, currency, taxes, discount, terms, tags and
 * lines, as a new document of the tenant's next number, dated today, due after the same payment window, and owing its
 * whole total.
 *
 * What makes the source *that* document is left behind: its number, status, payments, answer (accepted or not), e-mail
 * recipient, public link and history. An estimate stays an estimate, and an invoice an invoice.
 *
 * @param source The invoice or estimate, with its lines and tags.
 * @param options The number and the date of the copy.
 * @returns The input to create the copy with.
 */
export function buildInvoiceDuplicate(source: IInvoice, options: IInvoiceDuplicateOptions): InvoiceDuplicateInput {
	const invoiceDate = new Date(options.today);
	const dueDate = new Date(invoiceDate.getTime() + paymentWindowDaysOf(source) * DAY_MS);

	const copy: InvoiceDuplicateInput = {
		tenantId: source.tenantId,
		organizationId: source.organizationId,
		invoiceNumber: options.invoiceNumber,
		invoiceDate,
		dueDate,
		currency: source.currency,
		discountValue: source.discountValue,
		discountType: source.discountType,
		tax: source.tax,
		taxType: source.taxType,
		tax2: source.tax2,
		tax2Type: source.tax2Type,
		taxCalculationType: source.taxCalculationType,
		terms: source.terms,
		totalValue: source.totalValue,
		invoiceType: source.invoiceType,
		isEstimate: source.isEstimate ?? false,
		isAccepted: false,
		isArchived: false,
		status: 'DRAFT',
		paid: false,
		alreadyPaid: 0,
		amountDue: source.totalValue ?? 0,
		hasRemainingAmountInvoiced: false,
		invoiceItems: (source.invoiceItems ?? []).map(duplicateLineOf)
	} as InvoiceDuplicateInput;

	const keys = source as unknown as { fromOrganizationId?: string; toContactId?: string };
	const fromOrganizationId = source.fromOrganization?.id ?? keys.fromOrganizationId;
	if (fromOrganizationId) {
		copy.fromOrganizationId = fromOrganizationId;
	}
	const toContactId = source.toContact?.id ?? keys.toContactId;
	if (toContactId) {
		copy.toContactId = toContactId;
		copy.organizationContactId = source.organizationContactId ?? toContactId;
	}
	if (source.internalNote) {
		copy.internalNote = source.internalNote;
	}
	if (source.tags?.length) {
		copy.tags = source.tags.map((tag) => ({ id: tag.id }) as ITag);
	}
	return copy;
}
