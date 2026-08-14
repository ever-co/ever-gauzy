import { Component, HostListener, Inject, OnInit, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NbPopoverDirective } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { IAppVersionInfo, IUser } from '@gauzy/contracts';
import { of } from 'rxjs';
import { catchError, filter, tap } from 'rxjs/operators';
import { Environment, GAUZY_ENV } from '@gauzy/ui-config';
import { Store } from '@gauzy/ui-core/core';

/** Version + commit of one side (web or api) for the footer's "Version" popover. */
interface IVersionDisplay {
	version: string;
	commit: string;
}

@Component({
	selector: 'ngx-footer',
	styleUrls: ['./footer.component.scss'],
	templateUrl: './footer.component.html',
	standalone: false
})
export class FooterComponent extends TranslationBaseComponent implements OnInit {
	companyName: string;
	companySite: string;
	companyLink: string;
	companySiteLink: string;
	companyGithubLink: string;
	companyGitlabLink: string;
	companyFacebookLink: string;
	companyTwitterLink: string;
	companyLinkedinLink: string;
	user: IUser;

	/** GitHub repo base (no trailing `.git`), e.g. `https://github.com/ever-co/ever-gauzy`. */
	private readonly repoBaseUrl: string;

	/** This web build's version + commit (baked at build time). */
	readonly web: IVersionDisplay;

	/** The running API's version + commit (fetched from `/api/version`); null until/if it loads. */
	api: IVersionDisplay | null = null;

	/**
	 * The two footer popovers, queried by the template reference each trigger exports
	 * (`#versionPopover="nbPopover"` / `#legalPopover="nbPopover"`).
	 *
	 * Nebular's click trigger already opens each one, toggles it, and closes it on a click that
	 * lands outside its own trigger and panel — which is also what closes one panel when the
	 * other trigger is clicked, so the two never end up open together. These references exist
	 * only so both can additionally be closed on Escape and after one of the "Legal" links is
	 * followed (following a routerLink does not close the overlay on its own).
	 *
	 * They are queried BY NAME, not by directive type: a bare `@ViewChild(NbPopoverDirective)`
	 * silently binds to whichever popover comes first in the template, so the other one would
	 * never be closed and reordering the markup would quietly swap which one is.
	 */
	@ViewChild('versionPopover') versionPopover?: NbPopoverDirective;
	@ViewChild('legalPopover') legalPopover?: NbPopoverDirective;

	/**
	 * Open/closed state of each popover, mirrored from the directive's own
	 * `nbPopoverShowStateChange` output so `aria-expanded` stays truthful.
	 *
	 * These are never set from a click handler: Nebular also closes a panel on an outside click
	 * and on Escape, and a locally toggled flag would miss both and go stale.
	 */
	isVersionMenuShown = false;
	isLegalMenuShown = false;

	constructor(
		public translationService: TranslateService,
		private readonly store: Store,
		private readonly http: HttpClient,
		@Inject(GAUZY_ENV) readonly environment: Environment
	) {
		super(translationService);

		this.companyName = environment.COMPANY_NAME;
		this.companyLink = environment.COMPANY_LINK;
		this.companySite = environment.COMPANY_SITE_NAME;
		this.companySiteLink = environment.COMPANY_SITE_LINK;
		this.companyGithubLink = environment.COMPANY_GITHUB_LINK;
		this.companyGitlabLink = environment.COMPANY_GITLAB_LINK;
		this.companyFacebookLink = environment.COMPANY_FACEBOOK_LINK;
		this.companyTwitterLink = environment.COMPANY_TWITTER_LINK;
		this.companyLinkedinLink = environment.COMPANY_IN_LINK;

		this.repoBaseUrl = (environment.PROJECT_REPO ?? 'https://github.com/ever-co/ever-gauzy.git').replace(/\.git$/, '');
		this.web = { version: environment.version ?? '', commit: environment.commit ?? '' };
	}

	ngOnInit() {
		this.store.user$
			.pipe(
				filter((user) => !!user),
				tap((user: IUser) => (this.user = user))
			)
			.subscribe();

		// Fetch the running API's version so the footer can flag a drift between
		// the deployed web app and API. Public endpoint — works pre-login too.
		this.http
			.get<IAppVersionInfo>(`${this.environment.API_BASE_URL}/api/version`)
			.pipe(
				catchError(() => of(null)),
				tap((info) => {
					this.api = info ? { version: info.version ?? '', commit: info.commit ?? '' } : null;
				})
			)
			.subscribe();
	}

	/** Closes whichever footer popover is open. Safe to call when they are both already closed. */
	closeFooterMenus(): void {
		this.versionPopover?.hide();
		this.legalPopover?.hide();
	}

	/** Escape closes the footer popovers, which Nebular's click trigger does not do by itself. */
	@HostListener('document:keydown.escape')
	onEscapeKeydown(): void {
		this.closeFooterMenus();
	}

	/** Whether there is any build info at all to display. */
	get hasVersionInfo(): boolean {
		return this.hasInfo(this.web) || this.hasInfo(this.api);
	}

	/**
	 * True when the web and API report different builds (both known and not equal).
	 * When true the "Version" popover lists Web and API on their own rows; otherwise it
	 * collapses to a single Version row plus a Commit row.
	 */
	get isVersionMismatch(): boolean {
		return (
			this.hasInfo(this.web) &&
			this.hasInfo(this.api) &&
			(this.web.version !== this.api.version || this.web.commit !== this.api.commit)
		);
	}

	/** The single build to show when web and API agree (or only one is known). */
	get primary(): IVersionDisplay {
		return this.hasInfo(this.web) ? this.web : (this.api ?? this.web);
	}

	/** GitHub release/tag page for a version (empty when no version). */
	releaseUrl(version: string): string | null {
		return version ? `${this.repoBaseUrl}/releases/tag/${version}` : null;
	}

	/** GitHub commit page for a full commit SHA (empty when no commit). */
	commitUrl(commit: string): string | null {
		return commit ? `${this.repoBaseUrl}/commit/${commit}` : null;
	}

	/** Short 7-char commit for display. */
	shortCommit(commit: string): string {
		return commit ? commit.substring(0, 7) : '';
	}

	private hasInfo(info: IVersionDisplay | null): info is IVersionDisplay {
		return !!info && (!!info.version || !!info.commit);
	}
}
