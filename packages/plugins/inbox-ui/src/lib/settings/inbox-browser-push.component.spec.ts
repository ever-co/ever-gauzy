import { TestBed } from '@angular/core/testing';
import { ToastrService } from '@gauzy/ui-core/core';
import { InboxWebPushService } from '../services/inbox-web-push.service';
import { InboxBrowserPushComponent } from './inbox-browser-push.component';

/** Settings -> Notifications -> Browser notifications. */
describe('InboxBrowserPushComponent', () => {
	const push = { state: jest.fn(), enable: jest.fn(), disable: jest.fn() };
	const toastr = { danger: jest.fn() };

	async function render() {
		// Added to the root Jest defaults (Nebular's theme for the switch, the translations: keys stand for their text).
		TestBed.configureTestingModule({
			imports: [InboxBrowserPushComponent],
			providers: [
				{ provide: InboxWebPushService, useValue: push },
				{ provide: ToastrService, useValue: toastr }
			]
		});
		const fixture = TestBed.createComponent(InboxBrowserPushComponent);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();
		return { fixture, component: fixture.componentInstance, element: fixture.nativeElement as HTMLElement };
	}

	const switchOf = (element: HTMLElement) => element.querySelector('[data-test="browser-push-switch"] input') as HTMLInputElement;

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

	it('moves the switch back when switching on fails or is refused', async () => {
		push.state.mockResolvedValue('off');
		push.enable.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce('off');
		const { fixture, element } = await render();
		expect(switchOf(element).checked).toBe(false);

		// The click moves the switch first; the failure must move it back (the state read again is still off).
		switchOf(element).click();
		await fixture.whenStable();
		fixture.detectChanges();
		expect(push.enable).toHaveBeenCalledTimes(1);
		expect(toastr.danger).toHaveBeenCalledWith('INBOX.NOTIFICATION_SETTINGS.PUSH_FAILED');
		expect(switchOf(element).checked).toBe(false);

		// The permission prompt dismissed: switching on answers off.
		switchOf(element).click();
		await fixture.whenStable();
		fixture.detectChanges();
		expect(push.enable).toHaveBeenCalledTimes(2);
		expect(switchOf(element).checked).toBe(false);
	});

	it('shows a subscription the platform did not confirm as on but unconfirmed, with a retry that tells a new failure', async () => {
		push.state.mockResolvedValue('sync-failed');
		const { fixture, component, element } = await render();
		expect(element.querySelector('[data-test="browser-push-state"]')?.textContent).toContain('INBOX.NOTIFICATION_SETTINGS.PUSH_STATE.sync-failed');
		expect(switchOf(element).checked).toBe(true);
		expect(switchOf(element).disabled).toBe(false);
		expect(element.querySelector('[data-test="browser-push-retry"]')).not.toBeNull();

		await component.retry();
		expect(push.state).toHaveBeenCalledTimes(2);
		expect(toastr.danger).toHaveBeenCalledWith('INBOX.NOTIFICATION_SETTINGS.PUSH_RETRY_FAILED');
		expect(component.state()).toBe('sync-failed');

		push.state.mockResolvedValue('on');
		await component.retry();
		fixture.detectChanges();
		expect(component.state()).toBe('on');
		expect(toastr.danger).toHaveBeenCalledTimes(1);
		expect(element.querySelector('[data-test="browser-push-retry"]')).toBeNull();
	});

	it('switches an unconfirmed subscription off, and keeps the switch when that fails', async () => {
		push.state.mockResolvedValue('sync-failed');
		push.disable.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce('off');
		const { fixture, component, element } = await render();

		await component.toggle(false);
		fixture.detectChanges();
		expect(toastr.danger).toHaveBeenCalledWith('INBOX.NOTIFICATION_SETTINGS.PUSH_FAILED');
		expect(component.state()).toBe('sync-failed');
		expect(switchOf(element).checked).toBe(true);
		expect(switchOf(element).disabled).toBe(false);

		await component.toggle(false);
		expect(push.disable).toHaveBeenCalledTimes(2);
		expect(component.state()).toBe('off');
	});
});
