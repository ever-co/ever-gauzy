import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { Store } from '@gauzy/ui-core/core';
import { TrelloStatus, TrelloUiService } from '../../services/trello-ui.service';
import { TrelloPageComponent } from './trello-page.component';

const ORGANIZATION = { id: '11111111-2222-4333-8444-555555555555' };

function status(overrides: Partial<TrelloStatus> = {}): TrelloStatus {
	return { configured: true, webhooks: true, connection: null, ...overrides };
}

/** The Trello page: where the plugin is not loaded it only says so; otherwise Connect, the return from Trello, or the connection. */
describe('TrelloPageComponent', () => {
	const api = { status: jest.fn(), installState: jest.fn(), connect: jest.fn() };
	const router = { navigate: jest.fn().mockResolvedValue(true) };

	function render(query: Record<string, string> = {}, fragment: string | null = null, selectedOrganization$: Observable<{ id: string } | null> = of(ORGANIZATION)) {
		TestBed.configureTestingModule({
			imports: [TrelloPageComponent],
			providers: [
				{ provide: TrelloUiService, useValue: api },
				{ provide: Store, useValue: { selectedOrganization$ } },
				{ provide: Router, useValue: router },
				{ provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap(query)), fragment: of(fragment) } }
			]
		});
		const fixture = TestBed.createComponent(TrelloPageComponent);
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
		api.installState.mockReturnValue(of({ state: 'abc', authorizeUrl: 'https://trello.com/1/authorize?key=k' }));
		const { component, find, fixture } = render();
		expect(component.view).toBe('connect');
		const leave = jest.spyOn(component, 'leaveTo').mockImplementation(() => undefined);
		(find('connect-button') as HTMLButtonElement).click();
		fixture.detectChanges();
		expect(api.installState).toHaveBeenCalledWith(ORGANIZATION.id);
		expect(leave).toHaveBeenCalledWith('https://trello.com/1/authorize?key=k');
	});

	it('back from Trello with the token and the state: hands them to the API and opens the settings without the token', () => {
		api.status.mockReturnValue(of(status()));
		api.connect.mockReturnValue(of({ id: 'int-1', organizationId: ORGANIZATION.id }));
		render({ state: 's1' }, 'token=tok123');
		expect(api.connect).toHaveBeenCalledWith(ORGANIZATION.id, 'tok123', 's1');
		expect(router.navigate).toHaveBeenCalledWith(['/pages/integrations/trello', 'int-1'], { replaceUrl: true });
	});

	it('back from Trello before the organization is known: waits for it, reads no status meanwhile, connects once', () => {
		api.status.mockReturnValue(of(status()));
		api.connect.mockReturnValue(of({ id: 'int-1', organizationId: ORGANIZATION.id }));
		const organizations = new BehaviorSubject<{ id: string } | null>(null);
		const { component } = render({ state: 's1' }, 'token=tok123', organizations);
		expect(api.connect).not.toHaveBeenCalled();
		expect(api.status).not.toHaveBeenCalled();
		expect(component.finishing).toBe(true);
		organizations.next(ORGANIZATION);
		expect(api.connect).toHaveBeenCalledTimes(1);
		expect(api.connect).toHaveBeenCalledWith(ORGANIZATION.id, 'tok123', 's1');
	});

	it('back from Trello with a refused token: says why, drops the token from the address, and shows the status', () => {
		api.status.mockReturnValue(of(status()));
		api.connect.mockReturnValue(throwError(() => ({ error: { message: 'Trello does not know this token' } })));
		const { component } = render({ state: 's1' }, 'token=tok123');
		expect(component.returnError).toBe('Trello does not know this token');
		expect(router.navigate).toHaveBeenCalledWith(['/pages/integrations/trello'], { replaceUrl: true });
	});

	it('connected: shows the member and opens the settings', () => {
		api.status.mockReturnValue(of(status({ connection: { id: 'int-1', organizationId: ORGANIZATION.id, trelloMemberName: 'Ada', attentionReason: null } as never })));
		const { component, find } = render();
		expect(component.view).toBe('connected');
		expect(find('member')?.textContent).toContain('Ada');
		(find('open-settings') as HTMLButtonElement).click();
		expect(router.navigate).toHaveBeenCalledWith(['/pages/integrations/trello', 'int-1']);
	});
});
