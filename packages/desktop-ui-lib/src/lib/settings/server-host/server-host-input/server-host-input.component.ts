import { ChangeDetectionStrategy, Component, computed, inject, input, model, OnInit, signal } from '@angular/core';
import { IDesktopNetworkAddress } from '@gauzy/contracts';
import { NbButtonModule, NbComponentStatus, NbIconModule, NbInputModule, NbTooltipModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ToastrNotificationService } from '../../../services/toastr-notification.service';
import { NetworkAddressService } from '../network-address.service';
import { checkServerHost, IServerHostCheck, toServerHostAddress, withDetectedAddress } from '../server-host.util';

/**
 * The "Server Hostname / IP Address" field of Gauzy Server and Gauzy API Server (setup and settings):
 *
 * - shows an error for a value that is neither an IP address nor a host name (the parent blocks
 *   saving with {@link isValidServerHost}) and warnings for values that may not work as expected,
 *   such as an IP address while SSL is on;
 * - lists this computer's network addresses, read from the operating system, to pick one;
 * - "Detect my IP" fills in the best of them (a LAN IPv4 address when there is one).
 *
 * Nothing is picked for the user: the value only changes when they type or choose.
 */
@Component({
	selector: 'gauzy-server-host-input',
	templateUrl: './server-host-input.component.html',
	styleUrls: ['./server-host-input.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbInputModule, NbButtonModule, NbIconModule, NbTooltipModule, TranslatePipe]
})
export class ServerHostInputComponent implements OnInit {
	private readonly networkAddressService = inject(NetworkAddressService);
	private readonly notifier = inject(ToastrNotificationService);
	private readonly translateService = inject(TranslateService);

	/** The host setting (two-way: `[(host)]`). */
	public readonly host = model<string | null | undefined>('');
	/** Locks the field and its buttons, as the other server settings are while the server runs. */
	public readonly disabled = input(false);
	/** The server's "Use SSL" setting: an IP address then gets a hint to use a host name. */
	public readonly sslEnabled = input(false);

	/** This computer's network addresses, best first. */
	public readonly addresses = signal<IDesktopNetworkAddress[]>([]);
	public readonly detecting = signal(false);
	public readonly check = computed<IServerHostCheck>(() =>
		checkServerHost(this.host(), { sslEnabled: this.sslEnabled() })
	);
	public readonly status = computed<NbComponentStatus>(() => {
		const { error, warnings } = this.check();
		return error ? 'danger' : warnings.length ? 'warning' : 'basic';
	});
	protected readonly toServerHostAddress = toServerHostAddress;

	public async ngOnInit(): Promise<void> {
		this.addresses.set(await this.networkAddressService.list());
	}

	public onInput(event: Event): void {
		this.host.set((event.target as HTMLInputElement).value);
	}

	/** "Detect my IP": reads the addresses again (the network may have changed) and fills in the best one. */
	public async detect(): Promise<void> {
		this.detecting.set(true);
		try {
			const addresses = await this.networkAddressService.list();
			this.addresses.set(addresses);
			const [preferred] = addresses;
			if (!preferred) {
				this.notifier.warn(this.translateService.instant('TIMER_TRACKER.SETTINGS.SERVER_HOST.NO_ADDRESS'));
				return;
			}
			this.use(preferred);
		} finally {
			this.detecting.set(false);
		}
	}

	/** Puts an address in the field, keeping the `http://` or `https://` it started with. */
	public use(address: IDesktopNetworkAddress): void {
		this.host.set(withDetectedAddress(this.host(), address));
	}
}
