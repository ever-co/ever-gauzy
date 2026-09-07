import { Component, Inject, OnInit } from '@angular/core';
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
export class AboutComponent implements OnInit {
	/** Web build info — baked into the bundle at build time (empty on untagged local builds). */
	readonly web: IVersionRow;
	/** API build info — fetched from the public /api/version endpoint. `null` until it answers. */
	api: IVersionRow | null = null;
	/** True only once the /api/version request has actually failed — while it is
	 *  still pending the template shows a placeholder, not "unavailable". */
	apiFailed = false;

	/** GitHub repo base, for release/commit deep links. */
	readonly repoBaseUrl: string;
	readonly currentYear = new Date().getFullYear();

	constructor(private readonly http: HttpClient, @Inject(GAUZY_ENV) readonly environment: Environment) {
		this.repoBaseUrl = (environment.PROJECT_REPO ?? 'https://github.com/ever-co/ever-gauzy.git').replace(/\.git$/, '');
		this.web = { version: environment.version ?? '', commit: environment.commit ?? '' };
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
