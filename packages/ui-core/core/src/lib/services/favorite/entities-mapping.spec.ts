import { BaseEntityEnum, DocumentKindEnum } from '@gauzy/contracts';
import { ENTITY_ICONS, ENTITY_LINKS, ENTITY_TITLES, favoriteIcon } from './entities-mapping';

const ID = 'aaaaaaaa-1111-4111-8111-111111111111';

/**
 * A favorite in the left sidebar must open the RECORD itself, as a routed page of its own — not the list
 * the record lives in (owner, 2026-10-13, handover §4.P). The link builders get the record the favorite
 * details endpoint returned, so a type with more than one full view (a document's kind, an invoice that
 * is an estimate) picks the right one.
 *
 * That every target is a route the app really serves is checked against the router configuration by
 * `apps/gauzy/src/app/pages/favorite-links.routes.spec.ts`.
 */
describe('favorite entity links', () => {
	describe('Task', () => {
		it('opens the task on its own full-width page, not the dashboard list', () => {
			expect(ENTITY_LINKS[BaseEntityEnum.Task](ID)).toBe(`/pages/tasks/view/${ID}`);
		});
	});

	describe('Document', () => {
		it('opens a page in the document page at full width (the docs shell keeps only the tree beside it)', () => {
			expect(ENTITY_LINKS[BaseEntityEnum.Document](ID, { id: ID, kind: DocumentKindEnum.PAGE })).toBe(
				`/pages/documents/page/${ID}?view=full`
			);
		});

		it('opens a folder as that folder in the hub', () => {
			expect(ENTITY_LINKS[BaseEntityEnum.Document](ID, { id: ID, kind: DocumentKindEnum.FOLDER })).toBe(
				`/pages/documents?folder=${ID}`
			);
		});

		it('opens an uploaded file in the hub with its preview — a file has no page of its own', () => {
			expect(ENTITY_LINKS[BaseEntityEnum.Document](ID, { id: ID, kind: DocumentKindEnum.FILE })).toBe(
				`/pages/documents?id=${ID}`
			);
		});

		it('falls back to the hub, which handles every kind, when the kind is not known', () => {
			expect(ENTITY_LINKS[BaseEntityEnum.Document](ID)).toBe(`/pages/documents?id=${ID}`);
		});
	});

	describe('Invoice', () => {
		it('opens an invoice in the invoice view', () => {
			expect(ENTITY_LINKS[BaseEntityEnum.Invoice](ID, { id: ID, isEstimate: false })).toBe(
				`/pages/accounting/invoices/view/${ID}`
			);
		});

		it('opens an estimate (an invoice row flagged isEstimate) in the estimate view', () => {
			expect(ENTITY_LINKS[BaseEntityEnum.Invoice](ID, { id: ID, isEstimate: true })).toBe(
				`/pages/accounting/invoices/estimates/view/${ID}`
			);
		});
	});

	it.each([
		[BaseEntityEnum.OrganizationProject, `/pages/organization/projects/${ID}/edit`],
		[BaseEntityEnum.Employee, `/pages/employees/view/${ID}`],
		[BaseEntityEnum.Candidate, `/pages/employees/candidates/edit/${ID}`],
		[BaseEntityEnum.OrganizationContact, `/pages/contacts/view/${ID}`],
		[BaseEntityEnum.User, `/pages/users/edit/${ID}`],
		[BaseEntityEnum.Organization, `/pages/organizations/edit/${ID}`]
	])('%s opens the record page', (entity, link) => {
		expect(ENTITY_LINKS[entity](ID)).toBe(link);
	});

	it('maps every entity type to a link and an icon', () => {
		for (const entity of Object.values(BaseEntityEnum)) {
			expect(typeof ENTITY_LINKS[entity]).toBe('function');
			expect(ENTITY_LINKS[entity](ID)).toMatch(/^\/pages\//);
			expect(ENTITY_ICONS[entity]).toEqual(expect.any(String));
		}
	});
});

/**
 * The record types made favoritable for handover §4.P ("Estimates, Invoices (incl. received), Income/Expenses,
 * Payments, Proposals, … Equipment, Inventory items"): each has a sidebar link, icon and a readable name.
 */
describe('favorites of the newly favoritable record types', () => {
	it.each([
		[BaseEntityEnum.Product, `/pages/organization/inventory/view/${ID}`],
		[BaseEntityEnum.Proposal, `/pages/sales/proposals/details/${ID}`]
	])('%s opens its view page', (entity, link) => {
		expect(ENTITY_LINKS[entity](ID)).toBe(link);
	});

	it('shows an estimate with an icon of its own, an invoice with the invoice icon', () => {
		expect(favoriteIcon(BaseEntityEnum.Invoice, { id: ID, isEstimate: true })).not.toBe(
			ENTITY_ICONS[BaseEntityEnum.Invoice]
		);
		expect(favoriteIcon(BaseEntityEnum.Invoice, { id: ID, isEstimate: false })).toBe(
			ENTITY_ICONS[BaseEntityEnum.Invoice]
		);
		expect(favoriteIcon(BaseEntityEnum.Task)).toBe(ENTITY_ICONS[BaseEntityEnum.Task]);
	});

	it.each([
		[BaseEntityEnum.Invoice, { invoiceNumber: 12, toContact: { name: 'Acme' } }, '#12 · Acme'],
		[BaseEntityEnum.Invoice, { invoiceNumber: 12 }, '#12'],
		[BaseEntityEnum.Expense, { vendor: { name: 'Amazon' }, amount: 120, currency: 'USD' }, 'Amazon · 120 USD'],
		[BaseEntityEnum.Expense, { category: { name: 'Travel' }, amount: 5, currency: 'EUR' }, 'Travel · 5 EUR'],
		[
			BaseEntityEnum.Income,
			{ organizationContact: { name: 'Acme' }, amount: 900, currency: 'USD' },
			'Acme · 900 USD'
		],
		[BaseEntityEnum.Payment, { amount: 300, currency: 'USD', invoice: { invoiceNumber: 7 } }, '300 USD · #7'],
		[
			BaseEntityEnum.Payment,
			{ amount: 300, currency: 'USD', organizationContact: { name: 'Acme' } },
			'300 USD · Acme'
		],
		[BaseEntityEnum.Proposal, { jobPostContent: '<p>Build an <b>Angular</b> app</p>' }, 'Build an Angular app'],
		[BaseEntityEnum.Proposal, { jobPostUrl: 'https://jobs.example/1' }, 'https://jobs.example/1'],
		[BaseEntityEnum.Product, { translations: [{ name: '' }, { name: 'Laptop' }] }, 'Laptop']
	])('names a %s favorite after its own fields (%j)', (entity, record, title) => {
		expect(ENTITY_TITLES[entity]({ id: ID, ...record })).toBe(title);
	});

	it('leaves the name to the generic rules when the fields are not there', () => {
		expect(ENTITY_TITLES[BaseEntityEnum.Invoice]({ id: ID })).toBeUndefined();
		expect(ENTITY_TITLES[BaseEntityEnum.Product]({ id: ID })).toBeUndefined();
	});

	it('never renders a proposal job post as markup: script content stays text', () => {
		const title = ENTITY_TITLES[BaseEntityEnum.Proposal]({
			id: ID,
			jobPostContent: '<img src=x onerror="alert(1)"><script>alert(2)</script>Job'
		});
		expect(title).not.toContain('<');
	});
});
