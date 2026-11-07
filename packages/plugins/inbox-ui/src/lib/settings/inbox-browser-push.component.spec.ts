import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { ToastrService } from '@gauzy/ui-core/core';
import { InboxWebPushService } from '../services/inbox-web-push.service';
import { InboxBrowserPushComponent } from './inbox-browser-push.component';

/** Settings -> Notifications -> Browser notifications. */
describe('InboxBrowserPushComponent', () => {
	const push = { state: jest.fn(), enable: jest.fn(), disable: jest.fn() };
	const toastr = { danger: jest.fn() };

	async function render() {
		TestBed.resetTestingModule();
		TestBed.configureTestingModule({
			imports: [InboxBrowserPushComponent],
			providers: [
				{ provide: InboxWebPushService, useValue: push },
				{ provide: ToastrService, useValue: toastr },
				{ provide: TranslateService, useValue: { currentLang: 'en', instant: (key: string) => key, get: (key: string) => of(key), onLangChange: of(), onTranslationChange: of(), onDefaultLangChange: of() } }
			]
		});
		const fixture = TestBed.createComponent(InboxBrowserPushComponent);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();
		return { fixture, component: fixture.componentInstance, element: fixture.nativeElement as HTMLElement };
	}

	beforeEach(() => jest.resetAllMocks());

	it('shows nothing where the platform has web push off', async () => {
		push.state.mockResolvedValue('unavailable');
		const { element } = await render();
		expect(element.querySelector('[data-test="browser-push"]')).toBeNull();
	});

	it('subscribes this browser when switched on, and removes it when switched off', async () => {
		push.state.mockResolvedValue('off');
		push.enable.mockResolvedValue('on');
		push.disable.mockResolvedValue('off');
		const { component, element } = await render();
		expect(element.querySelector('[data-test="browser-push"]')).not.toBeNull();
		await component.toggle(true);
		expect(push.enable).toHaveBeenCalled();
		expect(component.state()).toBe('on');
		await component.toggle(false);
		expect(push.disable).toHaveBeenCalled();
		expect(component.state()).toBe('off');
	});

	it('tells a failure and shows the state the browser is in', async () => {
		push.state.mockResolvedValueOnce('off').mockResolvedValueOnce('blocked');
		push.enable.mockRejectedValue(new Error('denied'));
		const { component } = await render();
		await component.toggle(true);
		expect(toastr.danger).toHaveBeenCalledWith('INBOX.NOTIFICATION_SETTINGS.PUSH_FAILED');
		expect(component.state()).toBe('blocked');
		expect(component.busy()).toBe(false);
	});
});
