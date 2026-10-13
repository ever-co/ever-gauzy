import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of, tap } from 'rxjs';
import { IAppVersionInfo } from '@gauzy/contracts';
import { Environment, GAUZY_ENV } from '@gauzy/ui-config';

/** One deployed surface (web bundle or API) as shown on the About page. */
interface IVersionRow {
	version: string;
	commit: string;
}

@Component({
	selector: 'ngx-about',
	templateUrl: './about.component.html',
	styleUrls: ['./about.component.scss'],
	standalone: false
})
export class AboutComponent implements OnInit, OnDestroy {
	/** Web build info — baked into the bundle at build time (empty on untagged local builds). */
	readonly web: IVersionRow;
	/** API build info — fetched from the public /api/version endpoint. `null` until it answers. */
	api: IVersionRow | null = null;
	/** True only once the /api/version request has actually failed — while it is
	 *  still pending the template shows a placeholder, not "unavailable". */
	apiFailed = false;

	/** GitHub repo base, for release/commit deep links. */
	readonly repoBaseUrl: string;
	/** `owner/name`, shown on the GitHub panel. */
	readonly repoName: string;
	/**
	 * The "On GitHub" panel. Links only — nothing is fetched from GitHub, so the page makes no
	 * extra network call (the egress audit allows github.com links, not api.github.com) and works
	 * the same offline and self-hosted. `blob/HEAD` resolves to the repo's default branch.
	 */
	readonly githubLinks: { labelKey: string; icon: string; url: string }[];
	/** "Learn More": the product site, its docs and the company. Labels are the domains / name. */
	readonly learnMoreLinks: { label: string; icon: string; url: string }[] = [
		{ label: 'gauzy.co', icon: 'globe-outline', url: 'https://gauzy.co' },
		{ label: 'docs.gauzy.co', icon: 'book-open-outline', url: 'https://docs.gauzy.co' },
		{ label: 'Ever Co. LTD', icon: 'briefcase-outline', url: 'https://ever.co' }
	];
	readonly currentYear = new Date().getFullYear();

	/**
	 * This installation's build facts, read from the environment the web app was built with —
	 * no request. `production` is the Angular build flag; desktop covers both the Electron
	 * shell and the desktop app with the integrated server.
	 */
	readonly isProductionBuild: boolean;
	readonly isDemo: boolean;
	readonly isDesktop: boolean;
	/** Where this web app sends API calls, and where it is served from. */
	readonly apiAddress: string;
	readonly webAddress: string;
	/** Which address was just copied, so its button can show "Copied!" for a moment. */
	copied: 'api' | 'web' | null = null;
	private copiedTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(private readonly http: HttpClient, @Inject(GAUZY_ENV) readonly environment: Environment) {
		this.repoBaseUrl = (environment.PROJECT_REPO ?? 'https://github.com/ever-co/ever-gauzy.git').replace(/\.git$/, '');
		this.repoName = this.repoBaseUrl.replace(/^https?:\/\/github\.com\//, '');
		this.web = { version: environment.version ?? '', commit: environment.commit ?? '' };
		this.isProductionBuild = !!environment.production;
		this.isDemo = !!environment.DEMO;
		this.isDesktop = !!(environment.IS_ELECTRON || environment.IS_INTEGRATED_DESKTOP);
		this.apiAddress = environment.API_BASE_URL || window.location.origin;
		// The address actually serving this page. CLIENT_BASE_URL is a build default
		// (http://localhost:4200) that ordinary browser visits never update, so it is only the
		// fallback where the page origin is not a web address (the desktop app's file:// shell).
		const origin = window.location.origin;
		this.webAddress = /^https?:/.test(origin) ? origin : environment.CLIENT_BASE_URL || origin;
		this.githubLinks = [
			{ labelKey: 'ABOUT_PAGE.CARD.REPOSITORY', icon: 'github-outline', url: this.repoBaseUrl },
			{ labelKey: 'ABOUT_PAGE.GITHUB.RELEASES', icon: 'pricetags-outline', url: `${this.repoBaseUrl}/releases` },
			{ labelKey: 'ABOUT_PAGE.GITHUB.ISSUES', icon: 'alert-circle-outline', url: `${this.repoBaseUrl}/issues` },
			{ labelKey: 'ABOUT_PAGE.GITHUB.PULL_REQUESTS', icon: 'swap-outline', url: `${this.repoBaseUrl}/pulls` },
			{ labelKey: 'ABOUT_PAGE.GITHUB.CONTRIBUTORS', icon: 'people-outline', url: `${this.repoBaseUrl}/graphs/contributors` },
			{
				labelKey: 'ABOUT_PAGE.GITHUB.CONTRIBUTING',
				icon: 'edit-2-outline',
				url: `${this.repoBaseUrl}/blob/HEAD/.github/CONTRIBUTING.md`
			},
			{
				labelKey: 'ABOUT_PAGE.GITHUB.CODE_OF_CONDUCT',
				icon: 'heart-outline',
				url: `${this.repoBaseUrl}/blob/HEAD/.github/CODE_OF_CONDUCT.md`
			},
			{ labelKey: 'ABOUT_PAGE.GITHUB.LICENSE_FILE', icon: 'file-text-outline', url: `${this.repoBaseUrl}/blob/HEAD/LICENSE` }
		];
	}

	ngOnInit(): void {
		// Same public endpoint the footer's Version popover uses; this page shows the
		// DETAILED view (full commits, drift callout, links) that the popover abbreviates.
		this.http
			.get<IAppVersionInfo>(`${this.environment.API_BASE_URL}/api/version`)
			.pipe(
				catchError(() => {
					this.apiFailed = true;
					return of(null);
				}),
				tap((info) => {
					this.api = info ? { version: info.version ?? '', commit: info.commit ?? '' } : null;
				})
			)
			.subscribe();
	}

	/** Web and API were built from different commits — worth a callout, not just two rows. */
	get isVersionMismatch(): boolean {
		return !!(this.api && this.web.commit && this.api.commit && this.web.commit !== this.api.commit);
	}

	/**
	 * Whether the two builds match, for the status on the version cards. Only claimed when both
	 * commits are known; an untagged local build or a pending/failed API answer is `unknown`.
	 */
	get syncState(): 'in-sync' | 'different' | 'unknown' {
		if (!this.api?.commit || !this.web.commit) {
			return 'unknown';
		}
		return this.web.commit === this.api.commit ? 'in-sync' : 'different';
	}

	ngOnDestroy(): void {
		if (this.copiedTimer) {
			clearTimeout(this.copiedTimer);
		}
	}

	/**
	 * Copies an address; the button shows "Copied!" for 1.5s.
	 *
	 * `navigator.clipboard` exists only in secure contexts (https, or localhost), so a self-hosted
	 * install opened over plain HTTP falls back to a selected textarea + `execCommand('copy')`,
	 * which browsers still honour inside a click handler.
	 */
	copyAddress(which: 'api' | 'web'): void {
		const value = which === 'api' ? this.apiAddress : this.webAddress;
		const done = () => this.showCopied(which);
		if (navigator?.clipboard?.writeText) {
			navigator.clipboard
				.writeText(value)
				.then(done)
				.catch(() => this.copyWithSelection(value) && done());
			return;
		}
		if (this.copyWithSelection(value)) {
			done();
		}
	}

	/** Legacy copy path for non-secure contexts. Returns whether the browser reported success. */
	private copyWithSelection(value: string): boolean {
		const field = document.createElement('textarea');
		field.value = value;
		field.setAttribute('readonly', '');
		field.style.position = 'fixed';
		field.style.opacity = '0';
		document.body.appendChild(field);
		field.select();
		let copied = false;
		try {
			copied = document.execCommand('copy');
		} catch {
			copied = false;
		}
		document.body.removeChild(field);
		return copied;
	}

	private showCopied(which: 'api' | 'web'): void {
		this.copied = which;
		if (this.copiedTimer) {
			clearTimeout(this.copiedTimer);
		}
		this.copiedTimer = setTimeout(() => (this.copied = null), 1500);
	}

	releaseUrl(version: string): string {
		return `${this.repoBaseUrl}/releases/tag/${version}`;
	}

	commitUrl(commit: string): string {
		return `${this.repoBaseUrl}/commit/${commit}`;
	}

	shortCommit(commit: string): string {
		return commit ? commit.slice(0, 7) : '';
	}
}
