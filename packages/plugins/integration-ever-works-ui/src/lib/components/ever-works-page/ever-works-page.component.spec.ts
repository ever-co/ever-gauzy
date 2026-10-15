import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
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

	it('never links to a non-HTTPS app URL', () => {
		api.status.mockReturnValue(of({ ...STATUS, appUrl: 'javascript:alert(1)' }));
		const { find } = render();
		expect(find('create-key')).toBeNull();
	});
});
