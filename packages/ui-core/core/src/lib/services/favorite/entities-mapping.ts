import { BaseEntityEnum, DocumentKindEnum } from '@gauzy/contracts';

/**
 * Maps entity types to their corresponding FontAwesome icon classes
 * Used for consistent icon representation across the favorites system
 */
export const ENTITY_ICONS: Record<BaseEntityEnum, string> = {
	[BaseEntityEnum.OrganizationProject]: 'fas fa-book',
	[BaseEntityEnum.Task]: 'fas fa-tasks',
	[BaseEntityEnum.Employee]: 'fas fa-user-friends',
	[BaseEntityEnum.Candidate]: 'fas fa-user-tie',
	[BaseEntityEnum.Contact]: 'fas fa-address-book',
	[BaseEntityEnum.OrganizationTeam]: 'fas fa-users',
	[BaseEntityEnum.OrganizationVendor]: 'fas fa-truck',
	[BaseEntityEnum.OrganizationSprint]: 'fas fa-running',
	[BaseEntityEnum.OrganizationProjectModule]: 'fas fa-puzzle-piece',
	[BaseEntityEnum.TaskView]: 'fas fa-eye',
	[BaseEntityEnum.OrganizationDepartment]: 'fas fa-sitemap',
	[BaseEntityEnum.OrganizationDocument]: 'fas fa-file-alt',
	[BaseEntityEnum.Document]: 'fas fa-book',
	[BaseEntityEnum.Expense]: 'fas fa-money-bill-wave',
	[BaseEntityEnum.Invoice]: 'fas fa-file-invoice-dollar',
	[BaseEntityEnum.Income]: 'fas fa-coins',
	[BaseEntityEnum.DailyPlan]: 'fas fa-calendar-day',
	[BaseEntityEnum.Dashboard]: 'fas fa-th-large',
	[BaseEntityEnum.DashboardWidget]: 'fas fa-th',
	[BaseEntityEnum.ResourceLink]: 'fas fa-link',
	[BaseEntityEnum.ScreeningTask]: 'fas fa-clipboard-check',
	[BaseEntityEnum.TaskLinkedIssue]: 'fas fa-link',
	[BaseEntityEnum.User]: 'fas fa-user',
	[BaseEntityEnum.Tenant]: 'fas fa-building',
	[BaseEntityEnum.OrganizationContact]: 'fas fa-address-card',
	[BaseEntityEnum.Comment]: 'fas fa-comments',
	[BaseEntityEnum.Currency]: 'fas fa-coins',
	[BaseEntityEnum.Language]: 'fas fa-language',
	[BaseEntityEnum.Organization]: 'fas fa-building',
	[BaseEntityEnum.Broadcast]: 'fas fa-broadcast-tower',
	[BaseEntityEnum.OrganizationStrategicInitiative]: 'fas fa-bullseye',
	[BaseEntityEnum.Equipment]: 'fas fa-tools',
	[BaseEntityEnum.Payment]: 'fas fa-credit-card',
	[BaseEntityEnum.Product]: 'fas fa-box',
	[BaseEntityEnum.Proposal]: 'fas fa-file-signature'
};

/** Record-specific icons, where one type holds two kinds of record (an estimate is an invoice row). */
export function favoriteIcon(entity: BaseEntityEnum, record?: IFavoriteRecord): string {
	if (entity === BaseEntityEnum.Invoice && record?.['isEstimate']) {
		return 'fas fa-file-contract';
	}
	return ENTITY_ICONS[entity];
}

/**
 * The record a favorite points at, as the favorite details endpoint (`GET /favorite/type`) returned it.
 * Link builders read it when one entity type has more than one full view: a document's `kind`, an
 * invoice that `isEstimate`, the project a sprint or module belongs to.
 */
export interface IFavoriteRecord {
	id?: string;
	[key: string]: unknown;
}

/** Builds the URL a favorite opens. `record` is absent when only the id is known. */
export type FavoriteLinkBuilder = (id: string, record?: IFavoriteRecord) => string;

/**
 * A document favorite opens the document itself: a PAGE in the document page — inside the Documents
 * shell, which keeps only the narrow "All documents" tree beside it (owner, 2026-10-13) — and a FOLDER as
 * that folder. An uploaded FILE has no page of its own, so it (and a record whose kind is unknown) opens
 * in the hub with its preview, which handles every kind.
 */
function documentLink(id: string, record?: IFavoriteRecord): string {
	switch (record?.['kind']) {
		case DocumentKindEnum.PAGE:
			// `view=full`: the editor as wide as the shell allows, right rail closed — for this entry point only
			// (docs-ui `DOCS_PAGE_FULL_VIEW`); normal Documents navigation keeps the editor's defaults.
			return `/pages/documents/page/${id}?view=full`;
		case DocumentKindEnum.FOLDER:
			return `/pages/documents?folder=${id}`;
		default:
			return `/pages/documents?id=${id}`;
	}
}

/** An estimate is an invoice row flagged `isEstimate`; each has its own view page. */
function invoiceLink(id: string, record?: IFavoriteRecord): string {
	return record?.['isEstimate']
		? `/pages/accounting/invoices/estimates/view/${id}`
		: `/pages/accounting/invoices/view/${id}`;
}

/**
 * Where a sidebar favorite takes the user: the record's own full page wherever one exists (handover §4.P).
 *
 * Every target must be a route the app serves — `apps/gauzy/src/app/pages/favorite-links.routes.spec.ts`
 * resolves each one against the real router configuration. Types that have no page of their own yet land
 * on the closest page that shows them; the backend only lets the types carrying `@FavoriteService` be
 * favorited at all (see `GlobalFavoriteDiscoveryService`).
 */
export const ENTITY_LINKS: Record<BaseEntityEnum, FavoriteLinkBuilder> = {
	[BaseEntityEnum.OrganizationProject]: (id) => `/pages/organization/projects/${id}/edit`,
	[BaseEntityEnum.Task]: (id) => `/pages/tasks/view/${id}`,
	[BaseEntityEnum.Employee]: (id) => `/pages/employees/view/${id}`,
	[BaseEntityEnum.Candidate]: (id) => `/pages/employees/candidates/edit/${id}`,
	// The address/contact-details row has no page; the contacts hub is where contacts are read.
	[BaseEntityEnum.Contact]: () => `/pages/contacts`,
	[BaseEntityEnum.OrganizationTeam]: () => `/pages/organization/teams`,
	[BaseEntityEnum.OrganizationVendor]: () => `/pages/organization/vendors`,
	// Sprints are managed in their project's task settings; modules on their project's page.
	[BaseEntityEnum.OrganizationSprint]: (_id, record) =>
		record?.['projectId'] ? `/pages/tasks/settings/${record['projectId']}` : `/pages/tasks/dashboard`,
	[BaseEntityEnum.OrganizationProjectModule]: (_id, record) =>
		record?.['projectId']
			? `/pages/organization/projects/${record['projectId']}/edit`
			: `/pages/organization/projects`,
	[BaseEntityEnum.TaskView]: () => `/pages/tasks/dashboard`,
	[BaseEntityEnum.OrganizationDepartment]: () => `/pages/organization/departments`,
	[BaseEntityEnum.OrganizationDocument]: () => `/pages/organization/documents`,
	[BaseEntityEnum.Document]: documentLink,
	[BaseEntityEnum.Expense]: () => `/pages/accounting/expenses`,
	[BaseEntityEnum.Invoice]: invoiceLink,
	[BaseEntityEnum.Income]: () => `/pages/accounting/income`,
	[BaseEntityEnum.DailyPlan]: () => `/pages/tasks/me`,
	[BaseEntityEnum.Dashboard]: () => `/pages/dashboard`,
	[BaseEntityEnum.DashboardWidget]: () => `/pages/dashboard`,
	[BaseEntityEnum.ResourceLink]: () => `/pages/dashboard`,
	[BaseEntityEnum.ScreeningTask]: () => `/pages/tasks/dashboard`,
	[BaseEntityEnum.TaskLinkedIssue]: () => `/pages/tasks/dashboard`,
	[BaseEntityEnum.User]: (id) => `/pages/users/edit/${id}`,
	[BaseEntityEnum.Tenant]: () => `/pages/settings/general`,
	[BaseEntityEnum.OrganizationContact]: (id) => `/pages/contacts/view/${id}`,
	[BaseEntityEnum.Comment]: () => `/pages/dashboard`,
	[BaseEntityEnum.Currency]: () => `/pages/settings/general`,
	[BaseEntityEnum.Language]: () => `/pages/settings/general`,
	[BaseEntityEnum.Organization]: (id) => `/pages/organizations/edit/${id}`,
	[BaseEntityEnum.Broadcast]: () => `/pages/dashboard`,
	[BaseEntityEnum.OrganizationStrategicInitiative]: () => `/pages/goals`,
	[BaseEntityEnum.Equipment]: () => `/pages/organization/equipment`,
	[BaseEntityEnum.Payment]: () => `/pages/accounting/payments`,
	[BaseEntityEnum.Product]: (id) => `/pages/organization/inventory/view/${id}`,
	[BaseEntityEnum.Proposal]: (id) => `/pages/sales/proposals/details/${id}`
};

/** `120 USD` — an amount with its currency, as a record's name when it has no other. */
function amountOf(record: IFavoriteRecord): string | undefined {
	const amount = record?.['amount'];
	if (amount === undefined || amount === null || amount === '') {
		return undefined;
	}
	return [amount, record['currency']].filter((part) => part !== undefined && part !== null).join(' ');
}

/** The parts that are there, joined: `#12 · Acme`. */
function joined(...parts: unknown[]): string | undefined {
	const present = parts.filter((part) => typeof part === 'string' || typeof part === 'number').map(String);
	return present.filter((part) => part.trim()).join(' · ') || undefined;
}

const nameOf = (value: unknown): string | undefined => (value as { name?: string } | undefined)?.name;

/**
 * Text of rich-text HTML (a proposal's job post), for a sidebar label. Parsed by the browser's inert
 * DOMParser: nothing is executed or rendered, and the result is only ever bound as text.
 */
function textOf(html: unknown): string | undefined {
	if (typeof html !== 'string' || !html.trim()) {
		return undefined;
	}
	if (typeof DOMParser === 'undefined') {
		return html;
	}
	const text = new DOMParser().parseFromString(html, 'text/html').body?.textContent ?? '';
	return text.replace(/\s+/g, ' ').trim() || undefined;
}

/**
 * The sidebar label of a favorite whose record has no `name` / `title` of its own: an invoice is
 * known by its number and client, an expense by its vendor and amount, a product by its translated name.
 * The relations these read are joined by the favorite details read (API `FAVORITE_DETAILS`).
 */
export const ENTITY_TITLES: Partial<Record<BaseEntityEnum, (record: IFavoriteRecord) => string | undefined>> = {
	[BaseEntityEnum.Invoice]: (record) =>
		joined(record['invoiceNumber'] ? `#${record['invoiceNumber']}` : undefined, nameOf(record['toContact'])),
	[BaseEntityEnum.Expense]: (record) =>
		joined(
			nameOf(record['vendor']) || nameOf(record['category']) || (record['purpose'] as string),
			amountOf(record)
		),
	[BaseEntityEnum.Income]: (record) =>
		joined(nameOf(record['client']) || (record['clientName'] as string), amountOf(record)),
	[BaseEntityEnum.Payment]: (record) => {
		const invoiceNumber = (record['invoice'] as { invoiceNumber?: unknown } | undefined)?.invoiceNumber;
		return joined(amountOf(record), invoiceNumber ? `#${invoiceNumber}` : nameOf(record['organizationContact']));
	},
	[BaseEntityEnum.Proposal]: (record) => textOf(record['jobPostContent']) || (record['jobPostUrl'] as string),
	[BaseEntityEnum.Product]: (record) => {
		const translations = record['translations'] as { name?: string }[] | undefined;
		return translations?.find((translation) => translation?.name)?.name;
	}
};
