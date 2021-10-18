import { Component, OnDestroy, OnInit } from '@angular/core';
import { LegalService } from '../legal.service';

export const TERM_AND_POLICY_ENDPOINT = 'https://www.iubenda.com/api/terms-and-conditions/7927924';

@Component({
	selector: 'ga-terms-conditions',
	templateUrl: './terms-and-conditions.component.html',
	styleUrls: ['./terms-and-conditions.component.scss'],
})
export class TermsAndConditionsComponent implements OnInit, OnDestroy {

	term_and_policy: string;

	constructor(
		private legalService: LegalService
	) { }

	ngOnInit(): void {
		this.legalService
			.getContentFromFromUrl(TERM_AND_POLICY_ENDPOINT)
			.then((data: any) => {
				if (!!data.content) {
					this.term_and_policy = data.content;
				}
			});
	}

	ngOnDestroy(): void { }
}
