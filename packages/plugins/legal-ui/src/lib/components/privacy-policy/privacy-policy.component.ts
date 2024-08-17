import { DOCUMENT } from '@angular/common';
import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { LegalService } from '../../providers/legal.service';

export const PRIVACY_POLICY_ENDPOINT = 'https://www.iubenda.com/api/privacy-policy/18120170';
export const COOKIE_PRIVACY_POLICY_ENDPOINT = 'https://www.iubenda.com/api/privacy-policy/18120170/cookie-policy';

@Component({
	templateUrl: './privacy-policy.component.html',
	styleUrls: ['./privacy-policy.component.scss']
})
export class PrivacyPolicyComponent implements OnInit, OnDestroy {
	public privacy_policy: string;
	public cookie_policy: string;

	constructor(private readonly legalService: LegalService, @Inject(DOCUMENT) private readonly _document: Document) {}

	/**
	 * Load privacy policy from iubenda
	 */
	ngOnInit(): void {
		// Get privacy policy from iubenda
		this.getPrivacyPolicyJsonFromUrl(PRIVACY_POLICY_ENDPOINT);
		this.getCookiePolicyJsonFromUrl(COOKIE_PRIVACY_POLICY_ENDPOINT);

		// Add class to body to display privacy policy
		this._document.body.classList.add('privacy-container');
	}

	/**
	 * Load privacy policy from iubenda
	 *
	 * @param url https://www.iubenda.com/api/privacy-policy/18120170
	 */
	async getPrivacyPolicyJsonFromUrl(url: string) {
		try {
			// Get privacy policy from iubenda
			const data: any = await this.legalService.getContentFromFromUrl(PRIVACY_POLICY_ENDPOINT);

			// Add privacy policy to component
			if (data?.content) {
				this.privacy_policy = data.content;
			}
		} catch (error) {
			console.error('Error fetching privacy policy:', error);
		}
	}

	/**
	 * Load cookie policy from iubenda
	 *
	 * @param url https://www.iubenda.com/api/privacy-policy/18120170/cookie-policy
	 */
	async getCookiePolicyJsonFromUrl(url: string) {
		try {
			// Get cookie policy from iubenda
			const data: any = await this.legalService.getContentFromFromUrl(COOKIE_PRIVACY_POLICY_ENDPOINT);

			// Add cookie policy to component
			if (data?.content) {
				this.cookie_policy = data.content;
			}
		} catch (error) {
			console.error('Error fetching cookie policy:', error);
		}
	}

	/**
	 * Remove class to body to hide privacy policy
	 */
	ngOnDestroy() {
		this._document.body.classList.remove('privacy-container');
	}
}
