// The barrel pulls the whole app shell (cookies, Sentry); the page needs only these two tokens.
jest.mock('@gauzy/ui-core/core', () => ({ Store: class Store {}, ToastrService: class ToastrService {} }));

import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NbThemeModule } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { of, Subject, throwError } from 'rxjs';
import { Store, ToastrService } from '@gauzy/ui-core/core';
import { InboxNotificationSettingsService } from '../services/inbox-notification-settings.service';
import { InboxWebPushService } from '../services/inbox-web-push.service';
import { InboxNotificationSettingsPageComponent } from './notification-settings-page.component';

/** Settings -> Notifications: the switches, the email modes, the quiet hours and the digest hour. */
describe('InboxNotificationSettingsPageComponent', () => {
	const api = { forEmployee: jest.fn(), create: jest.fn(), update: jest.fn(), deliveryStatus: jest.fn() };
	const toastr = { danger: jest.fn(), success: jest.fn() };
	let employee: { id: string } | null = { id: 'e1' };

	function render() {
		// A suite renders more than once: the module of the render before is reset first.
		TestBed.resetTestingModule();
		TestBed.configureTestingModule({
			// The reset above drops the root defaults (jest.angular-defaults.ts), the theme among them.
			imports: [InboxNotificationSettingsPageComponent, NbThemeModule.forRoot()],
			providers: [
				{ provide: InboxNotificationSettingsService, useValue: api },
				// The browser notifications section has its own spec: here the platform has web push off.
				{ provide: InboxWebPushService, useValue: { state: async () => 'unavailable', enable: jest.fn(), disable: jest.fn() } },
				{ provide: ToastrService, useValue: toastr },
				{ provide: TranslateService, useValue: { currentLang: 'en', getCurrentLang: () => 'en', instant: (key: string) => key, translate: (key: string) => signal(key), get: (key: string) => of(key), onLangChange: of(), onTranslationChange: of(), onDefaultLangChange: of() } },
				{
					provide: Store,
					useValue: {
						user$: of({ id: 'u1', tenantId: 'ten', employee }),
						selectedOrganization$: of({ id: 'org', tenantId: 'ten' }),
						hasPermission: () => true
					}
				}
			]
		});
		const fixture = TestBed.createComponent(InboxNotificationSettingsPageComponent);
		fixture.detectChanges();
		return { fixture, component: fixture.componentInstance };
	}

	beforeEach(() => {
		jest.resetAllMocks();
		employee = { id: 'e1' };
		// The server says nothing about delivery unless a test says otherwise.
		api.deliveryStatus.mockReturnValue(of(null));
	});

	it('says in the email section when the server sends no notification emails, or none can go out for the organization', () => {
		api.forEmployee.mockReturnValue(of({ id: 's1', preferences: {} }));
		const status = (enabled: boolean, available: boolean) => ({
			email: { enabled, available },
			push: { enabled: false, available: false },
			checkedAt: '2026-11-11T12:00:00.000Z'
		});

		api.deliveryStatus.mockReturnValue(of(status(false, false)));
		let rendered = render();
		rendered.fixture.detectChanges();
		expect(rendered.component.emailNotice()).toBe('OFF');
		expect(rendered.fixture.nativeElement.querySelector('[data-test="email-notice-OFF"]')).not.toBeNull();

		api.deliveryStatus.mockReturnValue(of(status(true, false)));
		rendered = render();
		rendered.fixture.detectChanges();
		expect(rendered.component.emailNotice()).toBe('UNAVAILABLE');
		expect(rendered.fixture.nativeElement.querySelector('[data-test="email-notice-UNAVAILABLE"]')).not.toBeNull();

		api.deliveryStatus.mockReturnValue(of(status(true, true)));
		rendered = render();
		rendered.fixture.detectChanges();
		expect(rendered.component.emailNotice()).toBeNull();
		expect(rendered.fixture.nativeElement.querySelector('[data-test^="email-notice"]')).toBeNull();
	});

	it('shows no notice when the server does not say, and ignores an answer for an organization that is no longer the page\'s', () => {
		api.forEmployee.mockReturnValue(of({ id: 's1', preferences: {} }));
		const late = new Subject<unknown>();
		api.deliveryStatus.mockReturnValue(late);
		const { component } = render();
		expect(component.emailNotice()).toBeNull();
		(component as unknown as { scope: { employeeId: string } | null }).scope = { employeeId: 'other' } as never;
		late.next({ email: { enabled: false, available: false }, push: { enabled: false, available: false }, checkedAt: '' });
		expect(component.emailNotice()).toBeNull();
	});

	it("loads the employee's row for the selected organization", () => {
		api.forEmployee.mockReturnValue(of({ id: 's1', mention: false, preferences: { email: 'digest' } }));
		const { component } = render();
		expect(api.forEmployee).toHaveBeenCalledWith({ tenantId: 'ten', organizationId: 'org', employeeId: 'e1' });
		expect(component.view()).toBe('ready');
		expect(component.isOn('mention')).toBe(false);
		expect(component.isOn('comment')).toBe(true);
		expect(component.defaultMode()).toBe('digest');
	});

	it('says so when the user is not an employee here, and shows the error with a retry when the load fails', () => {
		employee = null;
		expect(render().component.view()).toBe('no-employee');
		expect(api.forEmployee).not.toHaveBeenCalled();

		employee = { id: 'e1' };
		api.forEmployee.mockReturnValue(throwError(() => ({ status: 500 })));
		expect(render().component.view()).toBe('error');
	});

	it('saves a switch optimistically and keeps what the API answered', () => {
		api.forEmployee.mockReturnValue(of({ id: 's1', preferences: {} }));
		api.update.mockReturnValue(of({ id: 's1', mention: false, preferences: {} }));
		const { component } = render();
		component.setKind('mention', false);
		expect(api.update).toHaveBeenCalledWith('s1', { tenantId: 'ten', organizationId: 'org', employeeId: 'e1' }, { mention: false });
		expect(component.isOn('mention')).toBe(false);
		expect(component.saving()).toBe(false);
	});

	it("merges a kind's email mode, the quiet hours and the digest hour into the preferences", () => {
		api.forEmployee.mockReturnValue(of({ id: 's1', preferences: { email: 'digest', emailByType: { Mention: 'immediate' } } }));
		api.update.mockImplementation((_id: string, _scope: unknown, input: { preferences: unknown }) => of({ id: 's1', preferences: input.preferences }));
		const { component } = render();
		component.setKindMode('Comment' as never, 'off');
		expect(api.update.mock.calls[0][2]).toEqual({ preferences: { email: 'digest', emailByType: { Mention: 'immediate', Comment: 'off' } } });
		component.setKindMode('Mention' as never, 'default');
		expect(component.ownModeOf('Mention' as never)).toBe('default');
		expect(component.modeOf('Mention' as never)).toBe('digest');
		component.toggleQuietHours(true);
		expect(component.quietHours()).toMatchObject({ start: '22:00', end: '07:00' });
		component.setQuietHour('start', { target: { value: '21:30' } } as never);
		expect(component.quietHours()?.start).toBe('21:30');
		component.setDigestHour(9);
		expect(component.digestHour()).toBe(9);
		expect(api.update).toHaveBeenCalledTimes(5);
	});

	it('holds every control while a save is on its way, so no second change overlaps it', () => {
		api.forEmployee.mockReturnValue(of({ id: 's1', preferences: {} }));
		api.update.mockReturnValue(new Subject());
		const { component } = render();
		component.setKind('mention', false);
		expect(component.saving()).toBe(true);
		component.setKind('comment', false);
		component.setDigestHour(9);
		expect(api.update).toHaveBeenCalledTimes(1);
		expect(component.isOn('comment')).toBe(true);
	});

	it('ignores the answer of a save or a load for a scope that is no longer the page\'s', () => {
		const answer = new Subject<{ id: string; mention?: boolean; preferences: Record<string, unknown> }>();
		api.forEmployee.mockReturnValue(of({ id: 's1', preferences: {} }));
		api.update.mockReturnValue(answer);
		const { component } = render();
		component.setKind('mention', false);
		(component as unknown as { scope: { employeeId: string } | null }).scope = { employeeId: 'other' } as never;
		answer.next({ id: 's9', mention: true, preferences: {} });
		expect(component.setting()?.id).toBe('s1');
		expect(component.saving()).toBe(false);
	});

	it('creates the row on the first change when there is none, reloads when that is refused, and puts a refused change back with a message', () => {
		api.forEmployee.mockReturnValue(of(null));
		api.create.mockReturnValue(of({ id: 's1', comment: false, preferences: {} }));
		const { component } = render();
		component.setKind('comment', false);
		expect(api.create).toHaveBeenCalledWith({ tenantId: 'ten', organizationId: 'org', employeeId: 'e1' }, { comment: false });
		expect(component.setting()?.id).toBe('s1');

		api.update.mockReturnValue(throwError(() => ({ status: 400, error: { message: 'No.' } })));
		component.setDefaultMode('off');
		expect(component.defaultMode()).toBe('immediate');
		expect(toastr.danger).toHaveBeenCalledWith('No.');

		// No row yet and the create refused: the stored state is read again, so the controls show it.
		api.forEmployee.mockClear();
		api.forEmployee.mockReturnValue(of(null));
		api.create.mockReturnValue(throwError(() => ({ status: 500 })));
		const fresh = render().component;
		fresh.setKind('comment', false);
		expect(api.forEmployee).toHaveBeenCalledTimes(2);
		expect(fresh.setting()).toBeNull();
	});
});
