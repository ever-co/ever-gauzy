/**
 * The component is exercised by instantiating it directly — the package's established test shape
 * (`document-comments.component.spec.ts`). Both `@gauzy/ui-core` barrels are stubbed: `core`
 * drags Akita's untranspiled ESM into the CommonJS runtime, and `i18n` only contributes the
 * translation base class, whose single job here is `getTranslation()`.
 *
 * The translation stub deliberately mimics the app's real `MissingTranslationHandler`: an
 * unknown key comes back **verbatim**. That is what the raw-enum fallback has to survive.
 */
jest.mock('@gauzy/ui-core/core', () => ({ Store: class Store {} }));
jest.mock('@gauzy/ui-core/i18n', () => ({
	TranslationBaseComponent: class TranslationBaseComponent {
		constructor(public readonly translateService: unknown) {}
		getTranslation(key: string): string {
			const dictionary: Record<string, string> = {
				'DOCS.ACTIVITY.SYSTEM': 'System',
				'DOCS.ACTIVITY.UNKNOWN_ACTOR': 'Unknown',
				'DOCS.ACTIVITY.ACTION.UPDATED': 'updated this',
				'DOCS.TABLE.COLUMNS.STATUS': 'Status',
				'DOCS.STATUS.READY': 'Ready',
				'DOCS.ACTIVITY.VALUE.TRUE': 'Yes',
				'DOCS.ACTIVITY.VALUE.FALSE': 'No'
			};
			return dictionary[key] ?? key;
		}
	}
}));

import { of, throwError } from 'rxjs';
import { ActionTypeEnum, ActorTypeEnum, IActivityLog, ID } from '@gauzy/contracts';
import { DOCS_ACTIVITY_MAX_ITEMS, DOCS_ACTIVITY_PAGE_SIZE } from '../../services/document-activity.service';
import { DocsDetailActivityComponent } from './docs-detail-activity.component';

const DOCUMENT_ID = 'eeeeeeee-1111-4111-8111-111111111111' as ID;

const row = (id: string, overrides: Partial<IActivityLog> = {}): IActivityLog =>
	({
		id,
		action: ActionTypeEnum.Updated,
		actorType: ActorTypeEnum.User,
		createdAt: new Date('2026-01-01T10:00:00Z'),
		...overrides
	} as unknown as IActivityLog);

/** Drains the microtask queue so a promise chain settles before the assertions. */
const flush = async (): Promise<void> => {
	for (let index = 0; index < 5; index++) await Promise.resolve();
};

/** Records the pages asked for so a test can assert the paging contract without HTTP. */
class ActivityServiceStub {
	public readonly pagesRequested: number[] = [];
	public total = 0;
	public pageFor: (page: number) => IActivityLog[] = () => [];
	public fail = false;

	getPage = jest.fn((_: ID, page: number = 1) => {
		this.pagesRequested.push(page);
		if (this.fail) return throwError(() => new Error('boom'));
		return of({ items: this.pageFor(page), total: this.total });
	});
}

function createComponent(): { component: DocsDetailActivityComponent; service: ActivityServiceStub } {
	const service = new ActivityServiceStub();
	const component = new DocsDetailActivityComponent({ instant: (key: string) => key } as never, service as never);
	component.documentId = DOCUMENT_ID;
	return { component, service };
}

describe('DocsDetailActivityComponent', () => {
	it('loads the first page when the bound document changes', async () => {
		const { component, service } = createComponent();
		service.total = 1;
		service.pageFor = () => [row('a1')];

		component.ngOnChanges({ documentId: { currentValue: DOCUMENT_ID } } as never);
		await flush();

		expect(service.pagesRequested).toEqual([1]);
		expect(component.entries.map((entry) => entry.id)).toEqual(['a1']);
	});

	it('🛑 asks for the NEXT PAGE on "Show more", not for an offset', async () => {
		const { component, service } = createComponent();
		service.total = 40;
		service.pageFor = (page) => [row(`p${page}`)];

		await component.reload();
		await component.showMore();

		expect(service.pagesRequested).toEqual([1, 2]);
		expect(component.entries.map((entry) => entry.id)).toEqual(['p1', 'p2']);
	});

	it('offers "Show more" only while unseen rows fit inside the panel cap', async () => {
		const { component, service } = createComponent();
		service.total = DOCS_ACTIVITY_MAX_ITEMS + 500;
		service.pageFor = (page) =>
			Array.from({ length: DOCS_ACTIVITY_PAGE_SIZE }, (_, index) => row(`p${page}-${index}`));

		await component.reload();
		expect(component.canShowMore).toBe(true);

		// Walk to the cap; the log is far longer, but the panel stops there.
		while (component.canShowMore) {
			await component.showMore();
		}

		expect(component.entries).toHaveLength(DOCS_ACTIVITY_MAX_ITEMS);
		expect(component.canShowMore).toBe(false);
	});

	it('hides "Show more" once the whole log is on screen', async () => {
		const { component, service } = createComponent();
		service.total = 2;
		service.pageFor = () => [row('a1'), row('a2')];

		await component.reload();

		expect(component.canShowMore).toBe(false);
	});

	it('keeps the rows already loaded when a later page fails, and retries THAT page', async () => {
		const { component, service } = createComponent();
		service.total = 40;
		service.pageFor = (page) => [row(`p${page}`)];

		await component.reload();
		service.fail = true;
		await component.showMore();

		expect(component.loadError).toBe(true);
		expect(component.entries.map((entry) => entry.id)).toEqual(['p1']);

		service.fail = false;
		component.retry();
		await flush();

		expect(service.pagesRequested).toEqual([1, 2, 2]);
		expect(component.loadError).toBe(false);
	});

	it('attributes a pipeline transition to System rather than to a person', () => {
		const { component } = createComponent();
		const entry = { isSystem: true, actorName: 'Ada Lovelace' } as never;

		expect(component.actorLabel(entry)).toBe('System');
	});

	it('falls back to "Unknown" when a user row carries no author', () => {
		const { component } = createComponent();

		expect(component.actorLabel({ isSystem: false, actorName: '' } as never)).toBe('Unknown');
	});

	it('renders the raw action for an event type outside ActionTypeEnum', () => {
		const { component } = createComponent();

		expect(component.actionLabel({ action: 'Teleported', actionLabelKey: null } as never)).toBe('Teleported');
		expect(component.actionLabel({ action: 'Updated', actionLabelKey: 'DOCS.ACTIVITY.ACTION.UPDATED' } as never)).toBe(
			'updated this'
		);
	});

	it('renders the raw enum when the value has no translation — never the translation key', () => {
		const { component } = createComponent();
		const change = { field: 'status', valueKeyPrefix: 'DOCS.STATUS.', showValues: true } as never;

		expect(component.valueLabel(change, 'READY')).toBe('Ready');
		expect(component.valueLabel(change, 'QUANTUM')).toBe('QUANTUM');
	});

	it('prints booleans as Yes/No and absent values as a dash', () => {
		const { component } = createComponent();
		const change = { field: 'isArchived', valueKeyPrefix: null, showValues: true } as never;

		expect(component.valueLabel(change, true)).toBe('Yes');
		expect(component.valueLabel(change, false)).toBe('No');
		expect(component.valueLabel(change, undefined)).toBe('—');
	});

	it('prints no before/after pair for an opaque field', () => {
		const { component } = createComponent();

		expect(
			component.hasValues({ showValues: false, previous: 'folder-a', next: 'folder-b' } as never)
		).toBe(false);
	});
});
