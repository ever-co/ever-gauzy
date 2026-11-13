import { ChangeDetectorRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { IIncome, IPagination } from '@gauzy/contracts';
import { ErrorHandlingService, IncomeService, Store, ToastrService } from '@gauzy/ui-core/core';
import { IncomeViewPageComponent } from './income-view-page.component';

/** What the page sends to `IncomeService.pagination`. */
interface IQuery {
	where: Record<string, any>;
	order?: Record<string, string>;
	skip?: number;
	take?: number;
}

function income(id: string, valueDate: string, amount: number, currency = 'USD', clientId = 'client'): IIncome {
	return {
		id,
		valueDate: new Date(`${valueDate}T12:00:00`),
		amount,
		currency,
		clientId,
		client: { id: clientId, name: 'Acme' }
	} as unknown as IIncome;
}

/** One page of `items`, as the API serves it: `skip` is the page number, from 1. */
function pageOf(items: IIncome[], query: IQuery): IPagination<IIncome> {
	const take = query.take ?? 10;
	const skip = query.skip ?? 1;
	return { items: items.slice((skip - 1) * take, skip * take), total: items.length };
}

/** The page with mocked services; only the income API answers anything. */
function setup(pagination: (query: IQuery) => Promise<IPagination<IIncome>> | IPagination<IIncome>) {
	const incomeService = { pagination: jest.fn(async (query: IQuery) => pagination(query)) };
	TestBed.configureTestingModule({
		providers: [
			{ provide: IncomeService, useValue: incomeService },
			{
				provide: TranslateService,
				useValue: { getCurrentLang: () => 'en', instant: (key: string) => key, onLangChange: new Subject() }
			},
			{ provide: ActivatedRoute, useValue: {} },
			{ provide: Router, useValue: {} },
			{ provide: NbDialogService, useValue: {} },
			{ provide: ToastrService, useValue: {} },
			{ provide: ErrorHandlingService, useValue: {} },
			{ provide: Store, useValue: {} },
			{ provide: ChangeDetectorRef, useValue: { markForCheck: jest.fn() } }
		]
	});
	const page = TestBed.runInInjectionContext(() => new IncomeViewPageComponent());
	// The page's private steps, driven directly: the template is not rendered.
	const internals = page as any;
	internals.organization = { id: 'org', tenantId: 'tenant' };
	/** Reads and draws the charts of `record`, as showing it does. */
	const loadCharts = (record: IIncome): Promise<void> => {
		page.income = record;
		return internals.loadCharts(record);
	};
	const queries = (): IQuery[] => incomeService.pagination.mock.calls.map(([query]) => query);
	return { page, internals, loadCharts, queries };
}

describe('IncomeViewPageComponent charts', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('reads every page of the client income, past the 100 the API serves at once', async () => {
		const current = income('current', '2026-03-10', 10);
		const clientIncomes = Array.from({ length: 250 }, (_, index) => income(`c${index}`, '2026-03-05', 1));
		// The client's months are the read ordered by date, then id; the payments and the month read nothing here.
		const isClientMonths = (query: IQuery) => !!query.where.clientId && !!query.order?.id;
		const { page, loadCharts, queries } = setup((query) => pageOf(isClientMonths(query) ? clientIncomes : [], query));

		await loadCharts(current);

		expect(queries().filter(isClientMonths).map((query) => [query.skip, query.take])).toEqual([
			[1, 100],
			[2, 100],
			[3, 100]
		]);
		// All 250 of them, and the income itself.
		expect(page.charts.clientTotal).toBe(260);
	});

	it("reads and adds up only the income's own currency", async () => {
		const current = income('current', '2026-03-10', 30, 'EUR');
		const month = [income('eur', '2026-03-02', 70, 'EUR'), income('usd', '2026-03-03', 500, 'USD')];
		const { page, loadCharts, queries } = setup((query) => pageOf(query.where.clientId ? [] : month, query));

		await loadCharts(current);

		expect(queries().length).toBeGreaterThan(0);
		expect(queries().every((query) => query.where.currency === 'EUR')).toBe(true);
		// A row in another currency, should the API return one, is not added to the month.
		expect(page.charts.share).toEqual({ amount: 30, rest: 70, total: 100, percent: 30 });
	});

	it("drops a previous income's chart reads that answer after another income is shown", async () => {
		// The first income's reads (in GBP) wait until the second income has been drawn, then answer with rows
		// that would change the second income's figures, were they taken.
		let release: () => void;
		const gate = new Promise<void>((resolve) => (release = resolve));
		const late = [income('late', '2026-03-12', 999, 'USD', 'client-b')];
		const { page, loadCharts } = setup(async (query) => {
			if (query.where.currency === 'GBP') {
				await gate;
				return pageOf(late, query);
			}
			return pageOf([], query);
		});
		const first = income('first', '2026-01-10', 10, 'GBP', 'client-a');
		const second = income('second', '2026-03-10', 20, 'USD', 'client-b');

		const firstCharts = loadCharts(first);
		await loadCharts(second);
		release();
		await firstCharts;

		expect(page.income).toBe(second);
		expect(page.charts.clientTotal).toBe(20);
		expect(page.charts.share).toEqual({ amount: 20, rest: 0, total: 20, percent: 100 });
	});

	it('stops reading pages, and draws nothing, once the page is destroyed', async () => {
		let release: () => void;
		const gate = new Promise<void>((resolve) => (release = resolve));
		const clientIncomes = Array.from({ length: 250 }, (_, index) => income(`c${index}`, '2026-03-05', 1));
		const isClientMonths = (query: IQuery) => !!query.where.clientId && !!query.order?.id;
		const { page, loadCharts, queries } = setup(async (query) => {
			await gate;
			return pageOf(isClientMonths(query) ? clientIncomes : [], query);
		});

		const charts = loadCharts(income('current', '2026-03-10', 10));
		page.ngOnDestroy();
		release();
		await charts;

		// The first page was already asked for; the second never is.
		expect(queries().filter(isClientMonths).map((query) => query.skip)).toEqual([1]);
		expect(page.charts.clientTotal).toBeNull();
	});
});

describe('IncomeViewPageComponent dialogs', () => {
	afterEach(() => TestBed.resetTestingModule());

	function dialog() {
		const onClose = new Subject<unknown>();
		return { ref: { onClose, close: jest.fn() } as unknown as NbDialogRef<unknown>, onClose };
	}

	it('acts on a dialog answer while the page still shows the same income', async () => {
		const { page, internals } = setup(() => pageOf([], { where: {} }));
		const current = income('current', '2026-03-10', 10);
		page.income = current;
		const { ref, onClose } = dialog();

		const answer = internals.ask(ref, current);
		onClose.next(true);

		await expect(answer).resolves.toBe(true);
	});

	it('drops a dialog answer once the page has turned to another income or organization', async () => {
		const { page, internals } = setup(() => pageOf([], { where: {} }));
		const current = income('current', '2026-03-10', 10);
		page.income = current;
		const { ref, onClose } = dialog();

		const answer = internals.ask(ref, current);
		// What a navigation or an organization switch does first: a new load owns the page.
		internals.loadSequence++;
		onClose.next(true);

		await expect(answer).resolves.toBeNull();
	});

	/** Edits an income through the form, saved by `save`: what the page reads after it, and the errors it reports. */
	async function saveEdit(save: (internals: any) => Promise<unknown>) {
		const { page, internals } = setup(() => pageOf([], { where: {} }));
		const current = income('current', '2026-03-10', 10);
		page.income = current;
		internals.incomeId = current.id;
		const { ref, onClose } = dialog();
		const getAll = jest.fn(async () => ({ items: [current], total: 1 }));
		const handleError = jest.fn();
		Object.assign(internals.dialogService, { open: jest.fn(() => ref) });
		Object.assign(internals.incomeService, { update: jest.fn(() => save(internals)), getAll });
		Object.assign(internals.toastrService, { success: jest.fn() });
		Object.assign(internals.errorHandler, { handleError });

		const edit = page.edit();
		onClose.next({ amount: 20, valueDate: new Date('2026-03-10T12:00:00'), isBonus: false, tags: [] });
		await edit;
		return { page, getAll, handleError };
	}

	it('reads the income again after an edit saved while the page still shows it', async () => {
		const { page, getAll } = await saveEdit(async () => undefined);

		expect(getAll).toHaveBeenCalledTimes(1);
		expect(page.state).toBe('ready');
	});

	it('does not read the income again when the organization changed while the edit was saving', async () => {
		const { getAll, handleError } = await saveEdit(async (internals) => {
			// What switching the organization does first: a new load owns the page.
			internals.organization = { id: 'other-org', tenantId: 'tenant' };
			internals.loadSequence++;
		});

		expect(getAll).not.toHaveBeenCalled();
		expect(handleError).not.toHaveBeenCalled();
	});
});
