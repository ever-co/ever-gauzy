import { ChangeDetectorRef, SimpleChange } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { ActionTypeEnum, BaseEntityEnum, IActivityLog } from '@gauzy/contracts';
import { ActivityLogService } from '@gauzy/ui-core/core';
import { RecentActivityComponent } from './recent-activity.component';
import { RECENT_ACTIVITY_CLOCK_MS } from './recent-activity.utils';

const ORGANIZATION = 'cccccccc-3333-4333-8333-333333333333';
const TENANT = 'dddddddd-4444-4444-8444-444444444444';

const row = (id: string): IActivityLog =>
	({
		id,
		entity: BaseEntityEnum.Task,
		entityId: `task-${id}`,
		action: ActionTypeEnum.Updated,
		data: { title: `Task ${id}` },
		createdAt: new Date()
	}) as IActivityLog;

/**
 * The Recent activity panel reads the activity log for the dashboard's organization, a page at a time,
 * newest first, and can narrow to tasks or projects; it shows an empty state and an error state.
 */
describe('RecentActivityComponent', () => {
	let service: { getPage: jest.Mock };
	let language: string;
	let languageChanges: Subject<{ lang: string }>;

	const panel = async (organizationId: string | null = ORGANIZATION) => {
		const translate = {
			getCurrentLang: () => language,
			getFallbackLang: () => 'en',
			onLangChange: languageChanges
		};
		const component = new RecentActivityComponent(
			service as unknown as ActivityLogService,
			{ markForCheck: jest.fn() } as unknown as ChangeDetectorRef,
			translate as unknown as TranslateService
		);
		Object.assign(component, { organizationId, tenantId: TENANT });
		component.ngOnChanges({ organizationId: new SimpleChange(undefined, organizationId, true) });
		await new Promise((resolve) => setTimeout(resolve));
		return component;
	};

	beforeEach(() => {
		service = { getPage: jest.fn(async () => ({ items: [row('1'), row('2')], total: 3 })) };
		language = 'en';
		languageChanges = new Subject();
	});

	it('reads the first page for the organization and shows its rows', async () => {
		const component = await panel();

		expect(service.getPage).toHaveBeenCalledWith({ organizationId: ORGANIZATION, tenantId: TENANT, page: 1 });
		expect(component.items.map((item) => item.title)).toEqual(['Task 1', 'Task 2']);
		expect(component.total).toBe(3);
		expect(component.hasMore).toBe(true);
		expect(component.loading).toBe(false);
	});

	it('tells the rows their ages again every minute while it is shown, and stops when it is gone', async () => {
		const component = await panel();
		const markForCheck = (component as unknown as { _changeDetectorRef: { markForCheck: jest.Mock } })
			._changeDetectorRef.markForCheck;
		jest.useFakeTimers({ now: Date.now() });
		try {
			component.ngOnInit();
			expect(component.items[0].when).toBe('now');
			markForCheck.mockClear();

			jest.advanceTimersByTime(5 * RECENT_ACTIVITY_CLOCK_MS);

			expect(component.items[0].when).toBe('5 minutes ago');
			expect(markForCheck).toHaveBeenCalled();

			language = 'zh';
			languageChanges.next({ lang: 'zh' });
			expect(component.items[0].when).toBe('5分钟前');

			component.ngOnDestroy();
			jest.advanceTimersByTime(60 * RECENT_ACTIVITY_CLOCK_MS);
			languageChanges.next({ lang: 'en' });
			expect(component.items[0].when).toBe('5分钟前');
		} finally {
			component.ngOnDestroy();
			jest.useRealTimers();
		}
	});

	it('appends the next page on "Show more", without a row already shown', async () => {
		const component = await panel();
		service.getPage.mockResolvedValueOnce({ items: [row('2'), row('3')], total: 3 });

		await component.loadMore();

		expect(service.getPage).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
		expect(component.items.map((item) => item.id)).toEqual(['1', '2', '3']);
		expect(component.hasMore).toBe(false);
	});

	it('narrows to one kind of record and starts again from the first page', async () => {
		const component = await panel();
		service.getPage.mockResolvedValueOnce({ items: [row('9')], total: 1 });

		component.setEntityFilter(BaseEntityEnum.OrganizationProject);
		await new Promise((resolve) => setTimeout(resolve));

		expect(service.getPage).toHaveBeenLastCalledWith({
			organizationId: ORGANIZATION,
			tenantId: TENANT,
			entity: BaseEntityEnum.OrganizationProject,
			page: 1
		});
		expect(component.items.map((item) => item.id)).toEqual(['9']);
	});

	it('has an empty state when there is no activity', async () => {
		service.getPage.mockResolvedValueOnce({ items: [], total: 0 });
		const component = await panel();

		expect(component.items).toEqual([]);
		expect(component.total).toBe(0);
		expect(component.failed).toBe(false);
		expect(component.loading).toBe(false);
	});

	it('has an error state when the activity cannot be read, and reads again on retry', async () => {
		service.getPage.mockRejectedValueOnce(new Error('500'));
		const component = await panel();

		expect(component.failed).toBe(true);
		expect(component.loading).toBe(false);

		await component.reload();

		expect(component.failed).toBe(false);
		expect(component.items).toHaveLength(2);
	});

	it('asks nothing before the dashboard has an organization', async () => {
		await panel(null);

		expect(service.getPage).not.toHaveBeenCalled();
	});

	it('drops a page that lands after a reload asked for another', async () => {
		let resolveFirst: (value: unknown) => void;
		service.getPage.mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)));
		const component = await panel();
		service.getPage.mockResolvedValueOnce({ items: [row('new')], total: 1 });

		await component.reload();
		resolveFirst({ items: [row('old')], total: 1 });
		await new Promise((resolve) => setTimeout(resolve));

		expect(component.items.map((item) => item.id)).toEqual(['new']);
	});

	it('stops offering more once a page comes back empty', async () => {
		const component = await panel();
		service.getPage.mockResolvedValueOnce({ items: [], total: 3 });

		await component.loadMore();

		expect(component.hasMore).toBe(false);
	});
});
