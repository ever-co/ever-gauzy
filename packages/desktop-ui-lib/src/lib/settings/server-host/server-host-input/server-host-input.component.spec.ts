import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IDesktopNetworkAddress } from '@gauzy/contracts';
import { ToastrNotificationService } from '../../../services/toastr-notification.service';
import { NetworkAddressService } from '../network-address.service';
import { ServerHostInputComponent } from './server-host-input.component';

const LAN: IDesktopNetworkAddress = { name: 'Wi-Fi', address: '192.168.1.20', family: 'IPv4', virtual: false };
const IPV6: IDesktopNetworkAddress = { name: 'Ethernet', address: 'fd00::20', family: 'IPv6', virtual: false };

describe('ServerHostInputComponent', () => {
	let fixture: ComponentFixture<ServerHostInputComponent>;
	let component: ServerHostInputComponent;
	let addresses: IDesktopNetworkAddress[];
	let notifier: { warn: jest.Mock };
	let hostChanges: Array<string | null | undefined>;

	const element = (): HTMLElement => fixture.nativeElement;
	const input = (): HTMLInputElement => element().querySelector('input');
	const detectButton = (): HTMLButtonElement => element().querySelector('.detect-button');
	const addressButtons = (): HTMLButtonElement[] => Array.from(element().querySelectorAll('.detected-address'));
	const errors = (): string[] =>
		Array.from(element().querySelectorAll('p.status-danger')).map((node) => node.textContent.trim());
	const warnings = (): string[] =>
		Array.from(element().querySelectorAll('p.status-warning')).map((node) => node.textContent.trim());

	async function render(host: string, options: { sslEnabled?: boolean; disabled?: boolean } = {}): Promise<void> {
		fixture = TestBed.createComponent(ServerHostInputComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('host', host);
		fixture.componentRef.setInput('sslEnabled', options.sslEnabled ?? false);
		fixture.componentRef.setInput('disabled', options.disabled ?? false);
		hostChanges = [];
		component.host.subscribe((value) => hostChanges.push(value));
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();
	}

	function type(value: string): void {
		input().value = value;
		input().dispatchEvent(new Event('input'));
		fixture.detectChanges();
	}

	beforeEach(async () => {
		addresses = [LAN, IPV6];
		notifier = { warn: jest.fn() };
		await TestBed.configureTestingModule({
			imports: [ServerHostInputComponent],
			providers: [
				{ provide: NetworkAddressService, useValue: { list: jest.fn(async () => addresses) } },
				{ provide: ToastrNotificationService, useValue: notifier }
			]
		}).compileComponents();
	});

	it('shows the host and reports what is typed (two-way binding)', async () => {
		await render('0.0.0.0');

		expect(input().value).toBe('0.0.0.0');
		type('192.168.1.30');
		expect(component.host()).toBe('192.168.1.30');
		expect(hostChanges).toEqual(['192.168.1.30']);
	});

	describe('invalid host (#7550)', () => {
		it.each(['999.1.1.1', 'bad host!'])('shows an error for %s', async (value) => {
			await render(value);

			expect(errors()).toEqual(['TIMER_TRACKER.SETTINGS.SERVER_HOST.INVALID']);
			expect(input().getAttribute('aria-invalid')).toBe('true');
			expect(input().classList).toContain('status-danger');
		});

		it.each(['192.168.1.20', 'gauzy.example.com', '0.0.0.0', 'localhost', '[::1]', ''])(
			'shows no error for %s',
			async (value) => {
				await render(value);

				expect(errors()).toEqual([]);
				expect(input().getAttribute('aria-invalid')).toBe('false');
				expect(input().classList).toContain('status-basic');
			}
		);

		it('clears the error once the value is fixed', async () => {
			await render('999.1.1.1');
			type('192.168.1.20');

			expect(errors()).toEqual([]);
		});
	});

	describe('SSL on (#7549)', () => {
		it('warns, as a hint, that an IP address is used', async () => {
			await render('192.168.1.20', { sslEnabled: true });

			expect(warnings()).toEqual(['TIMER_TRACKER.SETTINGS.SERVER_HOST.SSL_WITH_IP']);
			expect(errors()).toEqual([]);
			expect(input().classList).toContain('status-warning');
		});

		it('has no warning for a host name', async () => {
			await render('gauzy.example.com', { sslEnabled: true });

			expect(warnings()).toEqual([]);
		});

		it('follows the SSL toggle', async () => {
			await render('192.168.1.20');
			expect(warnings()).toEqual([]);

			fixture.componentRef.setInput('sslEnabled', true);
			fixture.detectChanges();
			expect(warnings()).toEqual(['TIMER_TRACKER.SETTINGS.SERVER_HOST.SSL_WITH_IP']);
		});
	});

	describe('detected addresses (#7547)', () => {
		it('lists this computer’s addresses without changing the host', async () => {
			await render('0.0.0.0');

			expect(addressButtons().map((button) => button.textContent.replace(/\s+/g, ' ').trim())).toEqual([
				'192.168.1.20 Wi-Fi',
				'[fd00::20] Ethernet'
			]);
			expect(component.host()).toBe('0.0.0.0');
			expect(hostChanges).toEqual([]);
		});

		it('puts a chosen address in the field (IPv6 in brackets)', async () => {
			await render('0.0.0.0');

			addressButtons()[1].click();
			fixture.detectChanges();

			expect(component.host()).toBe('[fd00::20]');
			expect(input().value).toBe('[fd00::20]');
		});

		it('shows no list when the computer has no address to offer', async () => {
			addresses = [];
			await render('0.0.0.0');

			expect(element().querySelector('.detected-addresses')).toBeNull();
		});
	});

	describe('Detect my IP (#7548)', () => {
		it('fills in the best address, keeping http:// or https://', async () => {
			await render('https://0.0.0.0');

			await component.detect();
			fixture.detectChanges();

			expect(component.host()).toBe('https://192.168.1.20');
			expect(hostChanges).toEqual(['https://192.168.1.20']);
			expect(notifier.warn).not.toHaveBeenCalled();
		});

		it('is wired to the button', async () => {
			await render('0.0.0.0');
			const detect = jest.spyOn(component, 'detect');

			detectButton().click();

			expect(detect).toHaveBeenCalled();
		});

		it('falls back to an IPv6 address when there is no IPv4 one', async () => {
			addresses = [IPV6];
			await render('');

			await component.detect();

			expect(component.host()).toBe('[fd00::20]');
		});

		it('keeps the host and says so when no address is found', async () => {
			await render('gauzy.example.com');
			addresses = [];

			await component.detect();

			expect(component.host()).toBe('gauzy.example.com');
			expect(hostChanges).toEqual([]);
			expect(notifier.warn).toHaveBeenCalledWith('TIMER_TRACKER.SETTINGS.SERVER_HOST.NO_ADDRESS');
		});
	});

	it('locks the field and its buttons while disabled (server running)', async () => {
		await render('0.0.0.0', { disabled: true });

		expect(input().disabled).toBe(true);
		expect(detectButton().disabled).toBe(true);
		expect(addressButtons().every((button) => button.disabled)).toBe(true);
	});
});
