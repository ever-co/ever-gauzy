import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Store } from '@gauzy/ui-core/core';
import { LinearStatus, LinearUiService } from '../../services/linear-ui.service';
import { LinearPageComponent } from './linear-page.component';

const ORGANIZATION = { id: '11111111-2222-4333-8444-555555555555' };

function status(overrides: Partial<LinearStatus> = {}): LinearStatus {
	return { configured: true, defaultStateMap: {}, connection: null, ...overrides };
}

/** The Linear page: where the plugin is not loaded it only says so; otherwise Connect, or the connection. */
describe('LinearPageComponent', () => {
	const api = { status: jest.fn(), installState: jest.fn() };
	const router = { navigate: jest.fn().mockResolvedValue(true) };

	function render(query: Record<string, string> = {}) {
		TestBed.configureTestingModule({
			imports: [LinearPageComponent],
			providers: [
				{ provide: LinearUiService, useValue: api },
				{ provide: Store, useValue: { selectedOrganization$: of(ORGANIZATION) } },
				{ provide: Router, useValue: router },
				{ provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap(query)) } }
			]
		});
		const fixture = TestBed.createComponent(LinearPageComponent);
		fixture.detectChanges();
		const el: HTMLElement = fixture.nativeElement;
		return { fixture, component: fixture.componentInstance, find: (test: string) => el.querySelector(`[data-test="${test}"]`) };
	}

	beforeEach(() => {
		jest.resetAllMocks();
		router.navigate.mockResolvedValue(true);
	});

	it('the plugin is not loaded (404): says so', () => {
		api.status.mockReturnValue(throwError(() => ({ status: 404 })));
		const { component, find } = render();
		expect(component.view).toBe('unavailable');
		expect(find('unavailable')).not.toBeNull();
		expect(api.status).toHaveBeenCalledWith(ORGANIZATION.id);
	});

	it('not configured on the server: says so, offers nothing', () => {
		api.status.mockReturnValue(of(status({ configured: false })));
		const { component, find } = render();
		expect(component.view).toBe('not-configured');
		expect(find('connect-button')).toBeNull();
	});

	it('connect: asks the API for the state and leaves for the authorize page', () => {
		api.status.mockReturnValue(of(status()));
		api.installState.mockReturnValue(of({ state: 'abc', authorizeUrl: 'https://linear.app/oauth/authorize?state=abc' }));
		const { component, find, fixture } = render();
		expect(component.view).toBe('connect');
		const leave = jest.spyOn(component, 'leaveTo').mockImplementation(() => undefined);
		(find('connect-button') as HTMLButtonElement).click();
		fixture.detectChanges();
		expect(api.installState).toHaveBeenCalledWith(ORGANIZATION.id);
		expect(leave).toHaveBeenCalledWith('https://linear.app/oauth/authorize?state=abc');
	});

	it('connected: shows the workspace and opens the settings; a callback id opens them at once', () => {
		api.status.mockReturnValue(of(status({ connection: { id: 'int-1', organizationId: ORGANIZATION.id, linearOrganizationName: 'Acme', attentionReason: null } as never })));
		const { component, find } = render({ integrationId: 'int-1' });
		expect(component.view).toBe('connected');
		expect(find('workspace')?.textContent).toContain('Acme');
		expect(router.navigate).toHaveBeenCalledWith(['/pages/integrations/linear', 'int-1'], { replaceUrl: true });
	});

	it('a callback error is shown above the page', () => {
		api.status.mockReturnValue(of(status()));
		const { component, find } = render({ error: 'denied' });
		expect(component.callbackError).toBe('denied');
		expect(find('callback-error')).not.toBeNull();
	});
});
