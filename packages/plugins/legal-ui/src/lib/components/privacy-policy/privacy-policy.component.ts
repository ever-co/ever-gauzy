import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { ILegalDocument } from '../../models/legal-document.model';
import { LegalService } from '../../providers/legal.service';

@Component({
	templateUrl: './privacy-policy.component.html',
	styleUrls: ['./privacy-policy.component.scss'],
	standalone: false
})
export class PrivacyPolicyComponent implements OnInit, OnDestroy {
	/** Rendered HTML of the Privacy Policy. Bundled with the application, never fetched. */
	public privacy_policy: string;

	/** Rendered HTML of the Cookie Policy. Bundled with the application, never fetched. */
	public cookie_policy: string;

	/** Metadata of the Privacy Policy - title, version, effective date, publishing entity. */
	public privacy: ILegalDocument | null = null;

	/** Metadata of the Cookie Policy - title, version, effective date, publishing entity. */
	public cookies: ILegalDocument | null = null;

	constructor(
		private readonly legalService: LegalService,
		private readonly translateService: TranslateService,
		@Inject(DOCUMENT) private readonly _document: Document
	) {}

	ngOnInit(): void {
		// Read the privacy and cookie policies from the bundled corpus
		this.loadPolicies();

		// Add class to body to display privacy policy
		this._document.body.classList.add('privacy-container');
	}

	/**
	 * Loads the Privacy Policy and the Cookie Policy from the corpus bundled into the application.
	 *
	 * The text is vendored from `@ever-co/legal` at build time, so this is a synchronous lookup
	 * that cannot fail because of a network problem or a lapsed third-party subscription.
	 */
	private loadPolicies(): void {
		const locale = this.translateService.currentLang;

		this.privacy = this.legalService.getDocument('privacy', locale);
		this.privacy_policy = this.privacy?.html ?? '';

		this.cookies = this.legalService.getDocument('cookies', locale);
		this.cookie_policy = this.cookies?.html ?? '';
	}

	/**
	 * Remove class from body to hide privacy policy
	 */
	ngOnDestroy() {
		this._document.body.classList.remove('privacy-container');
	}
}
