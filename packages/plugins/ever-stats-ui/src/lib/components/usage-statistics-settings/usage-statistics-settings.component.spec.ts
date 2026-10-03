// cspell:ignore abcdefghijk
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { EverStatsStatus, EverStatsUiService } from '../../services/ever-stats.service';
import { UsageStatisticsSettingsComponent } from './usage-statistics-settings.component';

const STATUS: EverStatsStatus = {
	enabled: true,
	reason: null,
	install_source: 'self-hosted',
	instance_id: '3d2b1a0c-5e4f-4a6b-8c7d-9e0f1a2b3c4d',
	key_id: 'abcdefghijk',
	serves: ['gauzy'],
	country: 'ZZ',
	api_url: 'https://api.ever.co',
	next_send_at: '2026-10-03T12:00:00.000Z',
	last_attempt: null,
	key_warning: 'encryption_key_unset',
	schema_url: 'https://api.ever.co/v1/stats/schema'
};
const PAYLOAD = '{"schema":"ever.stats.v1","counts":{"tenants":1}}';

describe('UsageStatisticsSettingsComponent', () => {
	const api = {
		status: jest.fn(),
		last: jest.fn(),
		preview: jest.fn(),
		setEnabled: jest.fn(),
		sendNow: jest.fn(),
		resetIdentity: jest.fn()
	};

	function render() {
		TestBed.configureTestingModule({
			imports: [UsageStatisticsSettingsComponent],
			providers: [{ provide: EverStatsUiService, useValue: api }]
		});
		const fixture = TestBed.createComponent(UsageStatisticsSettingsComponent);
		fixture.detectChanges();
		const el: HTMLElement = fixture.nativeElement;
		return { fixture, component: fixture.componentInstance, el, find: (test: string) => el.querySelector(`[data-test="${test}"]`) };
	}

	beforeEach(() => {
		jest.resetAllMocks();
		api.last.mockReturnValue(of({ payload: PAYLOAD, bytes: PAYLOAD.length, sent_at: '2026-10-02T10:00:00.000Z', http_status: 202, status: 'sent', period: '2026-10' }));
	});

	it('shows the controls, the key warning and the last payload to the operator', () => {
		api.status.mockReturnValue(of(STATUS));
		const { component, find } = render();
		expect(component.view).toBe('operator');
		expect(find('operator')).not.toBeNull();
		expect(find('managed')).toBeNull();
		expect(find('toggle')).not.toBeNull();
		expect(find('key-warning')).not.toBeNull();
		expect(find('last')?.textContent).toContain('"tenants": 1');
		expect(find('bytes')?.textContent).toContain(String(PAYLOAD.length));
	});

	it.each([['another tenant admin, or the module is not loaded', 404]])('shows "Managed by the instance operator" and never a payload to %s', (_who, status) => {
		api.status.mockReturnValue(throwError(() => ({ status })));
		const { component, find, el } = render();
		expect(component.view).toBe('managed');
		expect(find('managed')).not.toBeNull();
		expect(find('managed')?.querySelector('a')?.getAttribute('href')).toBe('https://api.ever.co/v1/stats/schema');
		expect(find('operator')).toBeNull();
		expect(el.querySelector('pre')).toBeNull();
		expect(api.last).not.toHaveBeenCalled();
		expect(api.preview).not.toHaveBeenCalled();
	});

	it('shows an error for any other failure', () => {
		api.status.mockReturnValue(throwError(() => ({ status: 500 })));
		const { component, find } = render();
		expect(component.view).toBe('error');
		expect(find('error')).not.toBeNull();
	});

	it('resets the identity only after the confirmation', () => {
		api.status.mockReturnValue(of(STATUS));
		api.resetIdentity.mockReturnValue(of({ ...STATUS, instance_id: 'new' }));
		const { fixture, find } = render();
		(find('reset') as HTMLButtonElement).click();
		fixture.detectChanges();
		expect(api.resetIdentity).not.toHaveBeenCalled();
		expect(find('reset-confirmation')).not.toBeNull();
		(find('reset-cancel') as HTMLButtonElement).click();
		fixture.detectChanges();
		expect(find('reset-confirmation')).toBeNull();
		(find('reset') as HTMLButtonElement).click();
		fixture.detectChanges();
		(find('reset-confirm') as HTMLButtonElement).click();
		fixture.detectChanges();
		expect(api.resetIdentity).toHaveBeenCalledTimes(1);
	});

	it('switches the statistics off and disables Send now', () => {
		api.status.mockReturnValue(of(STATUS));
		api.setEnabled.mockReturnValue(of({ ...STATUS, enabled: false, reason: 'ui' }));
		const { fixture, component, find } = render();
		component.toggle(false);
		fixture.detectChanges();
		expect(api.setEnabled).toHaveBeenCalledWith(false);
		expect((find('send-now') as HTMLButtonElement).disabled).toBe(true);
	});

	it('builds the preview only when asked', () => {
		api.status.mockReturnValue(of(STATUS));
		api.preview.mockReturnValue(of({ valid: true, error: null, payload: PAYLOAD, bytes: PAYLOAD.length, max_bytes: 16384 }));
		const { fixture, find } = render();
		expect(api.preview).not.toHaveBeenCalled();
		(find('show-preview') as HTMLButtonElement).click();
		fixture.detectChanges();
		expect(api.preview).toHaveBeenCalledTimes(1);
		expect(find('preview')).not.toBeNull();
	});

	it('says when Send now is used too often', () => {
		api.status.mockReturnValue(of(STATUS));
		api.sendNow.mockReturnValue(throwError(() => ({ status: 429 })));
		const { component } = render();
		component.sendNow();
		expect(component.notice).toBe('EVER_STATS.SEND_TOO_SOON');
	});
});
