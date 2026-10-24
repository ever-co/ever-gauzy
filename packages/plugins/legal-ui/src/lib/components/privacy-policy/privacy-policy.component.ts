import { Component, Inject, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { ILegalDocument, LegalDocumentSlug } from '../../models/legal-document.model';
import { LegalService } from '../../providers/legal.service';

/**
 * Renders the Privacy Policy and/or the Cookie Policy from the bundled corpus.
 *
 * Which of the two it shows comes from the route's `data.documents`, so the `privacy` and
 * `cookies` routes reuse this one component instead of duplicating the document markup.
 * With no `data.documents` the component shows both, which is how it behaved when it was
 * only mounted on the `privacy` route.
 */
@Component({
	templateUrl: './privacy-policy.component.html',
	styleUrls: ['./privacy-policy.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class PrivacyPolicyComponent implements OnInit, OnDestroy {
	/** Rendered HTML of the Privacy Policy. Bundled with the application, never fetched. */
	public privacy_policy: string;

	/** Rendered HTML of the Cookie Policy. Bundled with the application, never fetched. */
	public cookie_policy: string;

	/** Rendered HTML of the DPIA Support Pack. Bundled with the application, never fetched. */
	public dpia_policy: string;

	/** Metadata of the Privacy Policy - title, version, effective date, publishing entity. */
	public privacy: ILegalDocument | null = null;

	/** Metadata of the Cookie Policy - title, version, effective date, publishing entity. */
	public cookies: ILegalDocument | null = null;

	/** Metadata of the DPIA Support Pack - title, version, effective date, publishing entity. */
	public dpia: ILegalDocument | null = null;

	/** Whether the Privacy Policy section is rendered. Driven by the route's `data.documents`. */
	public showPrivacy = true;

	/** Whether the Cookie Policy section is rendered. Driven by the route's `data.documents`. */
	public showCookies = true;

	/** Whether the DPIA Support Pack section is rendered. Driven by the route's `data.documents`. */
	public showDpia = false;

	constructor(
		private readonly legalService: LegalService,
		private readonly translateService: TranslateService,
		private readonly route: ActivatedRoute,
		@Inject(DOCUMENT) private readonly _document: Document
	) {}

	ngOnInit(): void {
		// Pick the sections this route asked for
		this.resolveSections();

		// Read the privacy, cookie, and dpia policies from the bundled corpus
		this.loadPolicies();

		// Add class to body to display privacy policy
		this._document.body.classList.add('privacy-container');
	}

	/**
	 * Reads `data.documents` off the activated route and turns it into the section flags.
	 *
	 * A route that does not declare `documents` keeps the privacy and cookie sections, so
	 * mounting this component without route data renders exactly what it rendered before.
	 */
	private resolveSections(): void {
		const documents = this.route.snapshot.data['documents'] as LegalDocumentSlug[] | undefined;

		if (!documents?.length) {
			return;
		}

		this.showPrivacy = documents.includes('privacy');
		this.showCookies = documents.includes('cookies');
		this.showDpia = documents.includes('dpia');
	}

	/**
	 * Loads the Privacy Policy, Cookie Policy, and DPIA Support Pack from the corpus bundled
	 * into the application.
	 *
	 * The text is vendored from `@ever-co/legal` at build time, so this is a synchronous lookup
	 * that cannot fail because of a network problem or a lapsed third-party subscription.
	 */
	private loadPolicies(): void {
		const locale = this.translateService.getCurrentLang();

		this.privacy = this.legalService.getDocument('privacy', locale);
		this.privacy_policy = this.privacy?.html ?? '';

		this.cookies = this.legalService.getDocument('cookies', locale);
		this.cookie_policy = this.cookies?.html ?? '';

		this.dpia = this.legalService.getDocument('dpia', locale);
		this.dpia_policy = this.dpia?.html ?? '';
	}

	/**
	 * Remove class from body to hide privacy policy
	 */
	ngOnDestroy() {
		this._document.body.classList.remove('privacy-container');
	}
}