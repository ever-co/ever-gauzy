import { Component, OnInit } from '@angular/core';
import { SMSProviderEnum } from '@gauzy/contracts';

@Component({
    selector: 'ga-sms-gateway',
    templateUrl: './sms-gateway.component.html',
    styleUrls: ['./sms-gateway.component.scss'],
    standalone: false
})
export class SmsGatewayComponent implements OnInit {
	smsProviders: string[] = Object.values(SMSProviderEnum);

	readonly docsUrls: Record<string, string> = {
		[SMSProviderEnum.TWILIO]: 'https://www.twilio.com/docs/messaging'
	};

	// Local only: there is no SMS settings endpoint yet, so this only keeps
	// the toggle's state for the session and resets on reload.
	private readonly enabledProviders = new Set<string>();

	constructor() {}

	ngOnInit(): void {}

	isEnabled(provider: string): boolean {
		return this.enabledProviders.has(provider);
	}

	async providerChanged(provider: string, $event: boolean) {
		if ($event) {
			this.enabledProviders.add(provider);
		} else {
			this.enabledProviders.delete(provider);
		}
	}
}
