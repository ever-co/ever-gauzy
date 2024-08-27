import { DOCUMENT } from '@angular/common';
import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { LegalService } from '../../providers/legal.service';

export const TERM_AND_POLICY_ENDPOINT = 'https://www.iubenda.com/api/terms-and-conditions/7927924';

@Component({
	selector: 'ga-terms-conditions',
	templateUrl: './terms-and-conditions.component.html',
	styleUrls: ['./terms-and-conditions.component.scss']
})
export class TermsAndConditionsComponent implements OnInit, OnDestroy {
	public term_and_policy: string;

	constructor(private readonly legalService: LegalService, @Inject(DOCUMENT) private readonly _document: Document) {}

	ngOnInit(): void {
		this.getTermJsonFromUrl(TERM_AND_POLICY_ENDPOINT);
		this._document.body.classList.add('term-container');
	}

	/**
	 * Load Term from iubenda
	 *
	 * @param url https://www.iubenda.com/api/terms-and-conditions/7927924
	 */
	async getTermJsonFromUrl(url: string) {
		try {
			const data: any = await this.legalService.getContentFromFromUrl(url);
			if (data?.content) {
				this.term_and_policy = data.content;
			}
		} catch (error) {
			console.error('Error fetching terms and conditions:', error);
		}
	}

	/**
	 * Remove class to body to hide terms and conditions
	 */
	ngOnDestroy() {
		this._document.body.classList.remove('term-container');
	}
}
