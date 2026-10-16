import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { Store } from '@gauzy/ui-core/core';
import { EverWorksStatus, EverWorksUiService } from '../../services/ever-works.service';
import { EVER_WORKS_NEW_KEY_PATH, EverWorksPageComponent } from './ever-works-page.component';

const ORGANIZATION = { id: '11111111-2222-4333-8444-555555555555' };

const STATUS: EverWorksStatus = {
	enabled: true,
	pluginVersion: '0.1.0',
	contractVersion: '1',
	defaultApiUrl: 'https://api.example.test/api',
	appUrl: 'https://app.example.test'
};

/** The Ever Works page: where the plugin is not loaded it only says so (and asks nothing else). */
describe('EverWorksPageComponent', () => {
	const api = { status: jest.fn() };

	function render() {
		TestBed.configureTestingModule({
			imports: [EverWorksPageComponent],
			providers: [
				{ provide: EverWorksUiService, useValue: api },
				{ provide: Store, useValue: { selectedOrganization$: of(ORGANIZATION) } }
			]
		});
		const fixture = TestBed.createComponent(EverWorksPageComponent);
		fixture.detectChanges();
		const el: HTMLElement = fixture.nativeElement;
		return {
			component: fixture.componentInstance,
			find: (test: string) => el.querySelector(`[data-test="${test}"]`)
		};
	}

	beforeEach(() => jest.resetAllMocks());

	it('the plugin is not loaded (404): says so, asks nothing else', () => {
		api.status.mockReturnValue(throwError(() => ({ status: 404 })));
		const { component, find } = render();
		expect(component.view).toBe('unavailable');
		expect(find('unavailable')).not.toBeNull();
		expect(find('ready')).toBeNull();
		expect(api.status).toHaveBeenCalledTimes(1);
		expect(api.status).toHaveBeenCalledWith(ORGANIZATION.id);
	});

	it('another error: shows the error, not the switched-off notice', () => {
		api.status.mockReturnValue(throwError(() => ({ status: 500 })));
		const { component, find } = render();
		expect(component.view).toBe('error');
		expect(find('error')).not.toBeNull();
		expect(find('unavailable')).toBeNull();
	});

	it('loaded: shows the integration, the configured API and the key link', () => {
		api.status.mockReturnValue(of(STATUS));
		const { component, find } = render();
		expect(component.view).toBe('ready');
		expect(find('ready')).not.toBeNull();
		expect(find('default-api-url')?.textContent).toContain(STATUS.defaultApiUrl);
		expect(find('create-key')?.getAttribute('href')).toBe(`${STATUS.appUrl}${EVER_WORKS_NEW_KEY_PATH}`);
		expect(find('create-key')?.getAttribute('rel')).toContain('noopener');
	});

	it('loaded without configured URLs: no Ever Works address is rendered', () => {
		api.status.mockReturnValue(of({ ...STATUS, defaultApiUrl: null, appUrl: null }));
		const { find } = render();
		expect(find('ready')).not.toBeNull();
		expect(find('default-api-url')).toBeNull();
		expect(find('create-key')).toBeNull();
	});

	it('a late answer for the previous organization never overwrites the current one', () => {
		const organizations = new BehaviorSubject<{ id: string }>(ORGANIZATION);
		const answers: Record<string, Subject<EverWorksStatus>> = { first: new Subject(), second: new Subject() };
		api.status.mockImplementation((id: string) => (id === ORGANIZATION.id ? answers['first'] : answers['second']));
		TestBed.configureTestingModule({
			imports: [EverWorksPageComponent],
			providers: [
				{ provide: EverWorksUiService, useValue: api },
				{ provide: Store, useValue: { selectedOrganization$: organizations } }
			]
		});
		const fixture = TestBed.createComponent(EverWorksPageComponent);
		fixture.detectChanges();
		organizations.next({ id: '22222222-2222-4333-8444-555555555555' });
		answers['second'].error({ status: 404 });
		answers['first'].next(STATUS); // the slow answer of the first organization arrives last
		expect(fixture.componentInstance.view).toBe('unavailable');
	});

	it('a late answer to a retry for the previous organization never overwrites the current one', () => {
		const organizations = new BehaviorSubject<{ id: string }>(ORGANIZATION);
		const answers: Subject<EverWorksStatus>[] = [];
		api.status.mockImplementation(() => {
			const answer = new Subject<EverWorksStatus>();
			answers.push(answer);
			return answer;
		});
		TestBed.configureTestingModule({
			imports: [EverWorksPageComponent],
			providers: [
				{ provide: EverWorksUiService, useValue: api },
				{ provide: Store, useValue: { selectedOrganization$: organizations } }
			]
		});
		const fixture = TestBed.createComponent(EverWorksPageComponent);
		fixture.detectChanges();
		answers[0].error({ status: 500 }); // the first organization fails
		fixture.componentInstance.load(); // a retry for the first organization, still in flight…
		organizations.next({ id: '22222222-2222-4333-8444-555555555555' }); // …when another is selected
		expect(api.status).toHaveBeenLastCalledWith('22222222-2222-4333-8444-555555555555');
		answers[2].error({ status: 404 });
		answers[1].next(STATUS); // the retry's slow answer arrives last
		expect(fixture.componentInstance.view).toBe('unavailable');
	});

	it('while the next organization is asked for, the previous status (and its key link) is not shown', () => {
		const organizations = new BehaviorSubject<{ id: string }>(ORGANIZATION);
		const second = new Subject<EverWorksStatus>();
		api.status.mockImplementation((id: string) => (id === ORGANIZATION.id ? of(STATUS) : second));
		TestBed.configureTestingModule({
			imports: [EverWorksPageComponent],
			providers: [
				{ provide: EverWorksUiService, useValue: api },
				{ provide: Store, useValue: { selectedOrganization$: organizations } }
			]
		});
		const fixture = TestBed.createComponent(EverWorksPageComponent);
		fixture.detectChanges();
		const el: HTMLElement = fixture.nativeElement;
		expect(el.querySelector('[data-test="create-key"]')).not.toBeNull();
		organizations.next({ id: '22222222-2222-4333-8444-555555555555' }); // its answer is still pending
		fixture.detectChanges();
		expect(fixture.componentInstance.view).toBe('loading');
		expect(el.querySelector('[data-test="ready"]')).toBeNull();
		expect(el.querySelector('[data-test="create-key"]')).toBeNull();
		second.next({ ...STATUS, appUrl: null });
		fixture.detectChanges();
		expect(fixture.componentInstance.view).toBe('ready');
		expect(el.querySelector('[data-test="create-key"]')).toBeNull();
	});

	it('a retry asks again for the current organization', () => {
		api.status.mockReturnValueOnce(throwError(() => ({ status: 500 }))).mockReturnValueOnce(of(STATUS));
		const { component } = render();
		expect(component.view).toBe('error');
		component.load();
		expect(api.status).toHaveBeenCalledTimes(2);
		expect(api.status).toHaveBeenLastCalledWith(ORGANIZATION.id);
		expect(component.view).toBe('ready');
	});

	it('never links to a non-HTTPS app URL', () => {
		api.status.mockReturnValue(of({ ...STATUS, appUrl: 'javascript:alert(1)' }));
		const { find } = render();
		expect(find('create-key')).toBeNull();
	});
});
