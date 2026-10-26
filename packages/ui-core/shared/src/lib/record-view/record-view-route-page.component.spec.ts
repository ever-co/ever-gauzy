import { NO_ERRORS_SCHEMA } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, ParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { BaseEntityEnum } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { IRecordViewRouteData, RecordViewRoutePageComponent } from './record-view-route-page.component';

const ID = 'aaaaaaaa-1111-4111-8111-111111111111';
const OTHER = 'bbbbbbbb-2222-4222-8222-222222222222';
/** The page's own (element) injector: whatever it is, it resolves services. */
const anInjector = expect.objectContaining({ get: expect.any(Function) });
const TENANT = 'eeeeeeee-5555-4555-8555-555555555555';
const ORGANIZATION = 'cccccccc-3333-4333-8333-333333333333';
const OTHER_ORGANIZATION = 'dddddddd-4444-4444-8444-444444444444';
const scopeOf = (organizationId: string) => ({ organizationId, tenantId: TENANT });

/**
 * A record's full-width page driven by its route (`view/:id` + `data.recordView`): what a sidebar favorite
 * and a drawer's "expand to full width" icon open (handover §4.P).
 */
describe('RecordViewRoutePageComponent', () => {
	let fixture: ComponentFixture<RecordViewRoutePageComponent>;
	let params$: BehaviorSubject<ParamMap>;
	let organization$: BehaviorSubject<{ id: string; tenantId: string }>;
	let load: jest.Mock;
	let config: IRecordViewRouteData;

	beforeEach(async () => {
		params$ = new BehaviorSubject(convertToParamMap({ id: ID }));
		organization$ = new BehaviorSubject({ id: ORGANIZATION, tenantId: TENANT });
		load = jest.fn(async (id: string, _injector: unknown, scope: { organizationId: string }) => ({
			id,
			name: `Record ${id.slice(0, 4)}`,
			organizationId: scope.organizationId
		}));
		config = {
			heading: 'EXPENSES_PAGE.EXPENSES',
			backLink: '/pages/accounting/expenses',
			load,
			sections: (record) => [{ fields: [{ label: 'SM_TABLE.NAME', value: record.name }] }],
			subtitle: (record) => record.name,
			favorite: { entity: BaseEntityEnum.Expense }
		};
		await TestBed.configureTestingModule({
			declarations: [RecordViewRoutePageComponent],
			providers: [
				{
					provide: ActivatedRoute,
					useValue: { paramMap: params$.asObservable(), data: new BehaviorSubject({ recordView: config }) }
				},
				{ provide: Store, useValue: { selectedOrganization$: organization$.asObservable() } }
			],
			schemas: [NO_ERRORS_SCHEMA]
		}).compileComponents();
		fixture = TestBed.createComponent(RecordViewRoutePageComponent);
	});

	const settle = async () => {
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();
	};

	it('loads the record the URL names through the route config, with the page injector', async () => {
		await settle();

		expect(load).toHaveBeenCalledWith(ID, anInjector, scopeOf(ORGANIZATION));
		expect(fixture.componentInstance.state).toBe('ready');
		expect(fixture.componentInstance.sections).toEqual([
			{ fields: [{ label: 'SM_TABLE.NAME', value: 'Record aaaa' }] }
		]);
		expect(fixture.componentInstance.subtitle).toBe('Record aaaa');
		// The favorite star is named after the record when the config gives no name of its own.
		expect(fixture.componentInstance.favoriteName).toBe('Record aaaa');
	});

	it('renders the favorite star for the configured type and the record frame', async () => {
		await settle();

		const star = fixture.nativeElement.querySelector('ngx-favorite-toggle');
		expect(star).not.toBeNull();
		expect(fixture.nativeElement.querySelector('ngx-record-view')).not.toBeNull();
	});

	it('follows the URL to the next record when the page is reused', async () => {
		await settle();
		params$.next(convertToParamMap({ id: OTHER }));
		await settle();

		expect(load).toHaveBeenLastCalledWith(OTHER, anInjector, scopeOf(ORGANIZATION));
		expect(fixture.componentInstance.record.id).toBe(OTHER);
	});

	it('says "not found" when there is no such record the caller can see', async () => {
		load.mockResolvedValueOnce(null);
		await settle();

		expect(fixture.componentInstance.state).toBe('not-found');
		expect(fixture.componentInstance.record).toBeNull();
	});

	it.each([
		[403, 'forbidden'],
		[500, 'error']
	])('answers a %s with the "%s" state', async (status, state) => {
		load.mockRejectedValueOnce(new HttpErrorResponse({ status }));
		await settle();

		expect(fixture.componentInstance.state).toBe(state);
	});

	it('reloads within the new organization when the header switches it', async () => {
		await settle();
		organization$.next({ id: OTHER_ORGANIZATION, tenantId: TENANT });
		await settle();

		expect(load).toHaveBeenLastCalledWith(ID, anInjector, scopeOf(OTHER_ORGANIZATION));
		expect(fixture.componentInstance.state).toBe('ready');
	});

	it('reads "not found" for a record of another organization, so its star cannot file it there', async () => {
		load.mockResolvedValueOnce({ id: ID, name: 'Elsewhere', organizationId: OTHER_ORGANIZATION });
		await settle();

		expect(fixture.componentInstance.state).toBe('not-found');
		expect(fixture.componentInstance.record).toBeNull();
	});

	it('discards a load that a newer organization switch overtook', async () => {
		let answerFirst: (record: unknown) => void;
		load.mockImplementationOnce(() => new Promise((resolve) => (answerFirst = resolve)));
		fixture.detectChanges(); // first load, still pending
		organization$.next({ id: OTHER_ORGANIZATION, tenantId: TENANT });
		await settle();

		answerFirst({ id: ID, name: 'Stale', organizationId: ORGANIZATION });
		await settle();

		expect(fixture.componentInstance.record.organizationId).toBe(OTHER_ORGANIZATION);
		expect(fixture.componentInstance.state).toBe('ready');
	});

	/*
	 * Review on #10594: a list read can answer with another record than the one the URL names (a team read
	 * narrowed to the caller's own teams replaced the id filter), and the page showed the first result.
	 */
	it('reads "not found" when the loader answers with another record than the URL names', async () => {
		load.mockResolvedValueOnce({ id: OTHER, name: 'Someone else', organizationId: ORGANIZATION });
		await settle();

		expect(fixture.componentInstance.state).toBe('not-found');
		expect(fixture.componentInstance.record).toBeNull();
	});

	it('clears the previous record from the header (name, star) as soon as another one loads', async () => {
		await settle();
		let answer: (record: unknown) => void;
		load.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
		params$.next(convertToParamMap({ id: OTHER }));
		fixture.detectChanges();

		expect(fixture.componentInstance.subtitle).toBeNull();
		expect(fixture.componentInstance.favoriteName).toBeNull();
		expect(fixture.componentInstance.sections).toEqual([]);
		expect(fixture.nativeElement.querySelector('ngx-favorite-toggle')).toBeNull();

		answer({ id: OTHER, name: 'Record bbbb', organizationId: ORGANIZATION });
		await settle();
		expect(fixture.componentInstance.subtitle).toBe('Record bbbb');
	});
});
