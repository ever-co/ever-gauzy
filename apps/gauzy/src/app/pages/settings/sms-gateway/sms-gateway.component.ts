import { Component, OnInit } from '@angular/core';
import { SMSProviderEnum } from '@gauzy/contracts';

@Component({
	selector: 'ga-sms-gateway',
	templateUrl: './sms-gateway.component.html',
	styleUrls: ['./sms-gateway.component.css']
})
export class SmsGatewayComponent implements OnInit {
	smsProviders: string[] = Object.values(SMSProviderEnum);

	constructor() {}

	ngOnInit(): void {}

	async providerChanged(provider, $event) {}
}
