import {
	IOrganizationDocument,
	TIME_OFF_REQUEST_FORM_DOCUMENT_NAMES,
	TimeOffRequestFormTypeEnum
} from '@gauzy/contracts';

/** `name` compared without case or extra spaces: `' paid  days OFF request'` matches `Paid Days off Request`. */
const comparable = (name: unknown): string =>
	typeof name === 'string' ? name.trim().replace(/\s+/g, ' ').toLowerCase() : '';

/** When a document was last saved, in milliseconds; 0 when it carries no date. */
const savedAt = ({ updatedAt, createdAt }: IOrganizationDocument): number => {
	const time = new Date(updatedAt ?? createdAt ?? 0).getTime();
	return Number.isNaN(time) ? 0 : time;
};

/**
 * The organization document that holds the paid or unpaid request form (issue #5481): the one named as in
 * `TIME_OFF_REQUEST_FORM_DOCUMENT_NAMES`, whatever its place in the list. When several carry that name, the
 * most recently saved one wins; documents without a link are left out.
 *
 * @returns The document, or `null` when the organization has none of that name.
 */
export function findTimeOffRequestForm(
	documents: readonly IOrganizationDocument[] | null | undefined,
	type: TimeOffRequestFormTypeEnum
): IOrganizationDocument | null {
	const wanted = comparable(TIME_OFF_REQUEST_FORM_DOCUMENT_NAMES[type]);
	if (!wanted) {
		return null;
	}

	const matches = (documents ?? []).filter(
		(document) => comparable(document?.name) === wanted && comparable(document.documentUrl) !== ''
	);
	// A stable sort: documents saved at the same time (or without dates) keep the server's order.
	return [...matches].sort((a, b) => savedAt(b) - savedAt(a))[0] ?? null;
}
