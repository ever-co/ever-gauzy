import { NO_ERRORS_SCHEMA } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, ParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { BaseEntityEnum } from '@gauzy/contracts';
import { IRecordViewRouteData, RecordViewRoutePageComponent } from './record-view-route-page.component';

const ID = 'aaaaaaaa-1111-4111-8111-111111111111';
const OTHER = 'bbbbbbbb-2222-4222-8222-222222222222';
/** The page's own (element) injector: whatever it is, it resolves services. */
const anInjector = expect.objectContaining({ get: expect.any(Function) });

/**
 * A record's full-width page driven by its route (`view/:id` + `data.recordView`): what a sidebar favorite
 * and a drawer's "expand to full width" icon open (handover §4.P).
 */
describe('RecordViewRoutePageComponent', () => {
	let fixture: ComponentFixture<RecordViewRoutePageComponent>;
	let params$: BehaviorSubject<ParamMap>;
	let load: jest.Mock;
	let config: IRecordViewRouteData;

	beforeEach(async () => {
		params$ = new BehaviorSubject(convertToParamMap({ id: ID }));
		load = jest.fn(async (id: string) => ({ id, name: `Record ${id.slice(0, 4)}` }));
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
				}
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

		expect(load).toHaveBeenCalledWith(ID, anInjector);
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

		expect(load).toHaveBeenLastCalledWith(OTHER, anInjector);
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
});
