import { Component, OnDestroy, OnInit } from '@angular/core';
import { UntilDestroy } from '@ngneat/until-destroy';
import { LegalService } from '../legal.service';

export const PRIVACY_POLICY_ENDPOINT = 'https://www.iubenda.com/api/privacy-policy/18120170';
export const COOKIE_PRIVACY_POLICY_ENDPOINT = 'https://www.iubenda.com/api/privacy-policy/18120170/cookie-policy';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './privacy-policy.component.html',
	styleUrls: ['./privacy-policy.component.scss'],
})

export class PrivacyPolicyComponent
	implements OnInit, OnDestroy {

	privacy_policy: string;
	cookie_policy: string;

	constructor(
		private legalService: LegalService
	) { }

	ngOnInit(): void {
		this.getPrivacyPolicyJsonFromUrl(PRIVACY_POLICY_ENDPOINT);
		this.getCookiePolicyJsonFromUrl(COOKIE_PRIVACY_POLICY_ENDPOINT);
	}

	/**
	 * Load privacy policy from iubenda
	 * 
	 * @param url https://www.iubenda.com/api/privacy-policy/18120170
	 */
	getPrivacyPolicyJsonFromUrl(url: string) {
		this.legalService
			.getContentFromFromUrl(PRIVACY_POLICY_ENDPOINT)
			.then((data: any) => {
				if (!!data.content) {
					this.privacy_policy = data.content;
				}
			});
	}

	/**
	 * Load cookie policy from iubenda
	 * 
	 * @param url https://www.iubenda.com/api/privacy-policy/18120170/cookie-policy
	 */
	getCookiePolicyJsonFromUrl(url: string) {
		this.legalService
			.getContentFromFromUrl(COOKIE_PRIVACY_POLICY_ENDPOINT)
			.then((data: any) => {
				if (!!data.content) {
					this.cookie_policy = data.content;
				}
			});
	}

	ngOnDestroy(): void { }
}
