import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { ILegalDocument } from '../../models/legal-document.model';
import { LegalService } from '../../providers/legal.service';

@Component({
	selector: 'ga-terms-conditions',
	templateUrl: './terms-and-conditions.component.html',
	styleUrls: ['./terms-and-conditions.component.scss'],
	standalone: false
})
export class TermsAndConditionsComponent implements OnInit, OnDestroy {
	/** Rendered HTML of the Terms of Service. Bundled with the application, never fetched. */
	public term_and_policy: string;

	/** Metadata of the rendered document - title, version, effective date, publishing entity. */
	public terms: ILegalDocument | null = null;

	constructor(
		private readonly legalService: LegalService,
		private readonly translateService: TranslateService,
		@Inject(DOCUMENT) private readonly _document: Document
	) {}

	ngOnInit(): void {
		this.loadTerms();
		this._document.body.classList.add('term-container');
	}

	/**
	 * Loads the Terms of Service from the corpus bundled into the application.
	 *
	 * The text is vendored from `@ever-co/legal` at build time, so this is a synchronous lookup
	 * that cannot fail because of a network problem or a lapsed third-party subscription.
	 */
	private loadTerms(): void {
		this.terms = this.legalService.getDocument('tos', this.translateService.currentLang);
		this.term_and_policy = this.terms?.html ?? '';
	}

	/**
	 * Remove class from body to hide terms and conditions
	 */
	ngOnDestroy() {
		this._document.body.classList.remove('term-container');
	}
}
