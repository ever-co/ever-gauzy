import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@gauzy/ui-config';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { catchError, map } from 'rxjs/operators';
import { combineLatest, Observable, of } from 'rxjs';
import { IAppConfig } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';
import { AppService } from '@gauzy/ui-core/core';

/**
 * Interface representing a social link.
 */
export interface ISocialLink {
	/** The URL of the social link. */
	url: string;
	/** The icon associated with the social link. */
	icon: string;
	/** Indicates whether to show or hide the social link. */
	show: boolean;
	/** (Optional) The target attribute for the link. */
	target?: string;
	/** (Optional) The link attribute for the link. */
	link?: string;
	/** (Optional) The title attribute for the link. */
	title?: string;
}

/**
 * A sign-in method contributed by an optional sign-in plugin (Ever ID, Keycloak), shown as a labelled
 * button above the social icons.
 */
export interface ISignInProvider {
	/** Stable id, used in tests and as the track key. */
	id: 'ever-id' | 'keycloak';
	/** The API route that starts the sign-in. */
	url: string;
	/** Translation key of the button label. */
	titleKey: string;
	/** The most prominent additional sign-in method gets the primary style. */
	prominent: boolean;
}

/**
 * Returns a configured sign-in link, or an empty string when it is unset (or still the Docker
 * placeholder the container entrypoint replaces at start).
 *
 * @param link - The environment value.
 * @returns The link to use, or `''`.
 */
export function configuredSignInLink(link: string | undefined): string {
	const value = (link ?? '').trim();
	return value && !value.startsWith('DOCKER_') ? value : '';
}

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-social-links',
	templateUrl: './social-links.component.html',
	styleUrls: ['./social-links.component.scss'],
	standalone: false
})
export class SocialLinksComponent implements OnInit {
	public socialLinks$: Observable<ISocialLink[]>; // Observable for an array of social links
	public signInProviders$: Observable<ISignInProvider[]>; // Sign-in plugins that are configured and enabled
	public configs: IAppConfig;
	private readonly _appService = inject(AppService);
	private readonly _http = inject(HttpClient);

	/**
	 * Lifecycle hook called after Angular has initialized all data-bound properties of a directive.
	 * Called once after the first ngOnChanges().
	 */
	ngOnInit(): void {
		this.socialLinks$ = this._appService.getAppConfigs().pipe(
			/**
			 * Map the application configurations to social links.
			 */
			map((configs: IAppConfig) => this.getSocialLinks(configs)),
			/**
			 * Handle component lifecycle to avoid memory leaks.
			 */
			untilDestroyed(this)
		);

		this.signInProviders$ = combineLatest([
			this.signInProvider('ever-id', environment.ZITADEL_AUTH_LINK, '/auth/zitadel/config', 'LOGIN_PAGE.SIGN_IN_WITH_EVER_ID', true),
			this.signInProvider('keycloak', environment.KEYCLOAK_AUTH_LINK, '/auth/keycloak/config', 'LOGIN_PAGE.SIGN_IN_WITH_KEYCLOAK', false)
		]).pipe(
			map((providers) => providers.filter((provider): provider is ISignInProvider => !!provider)),
			untilDestroyed(this)
		);
	}

	/**
	 * A sign-in plugin's button, shown only when its link is configured in the web app AND the API
	 * reports the plugin as enabled. Without a configured link no request is made at all.
	 *
	 * @param id - Provider id.
	 * @param link - The configured sign-in link.
	 * @param configPath - The plugin's config route, relative to the API prefix.
	 * @param titleKey - Translation key of the label.
	 * @param prominent - Whether the button gets the primary style.
	 * @returns The provider, or `null` when it must not be shown.
	 */
	private signInProvider(
		id: ISignInProvider['id'],
		link: string | undefined,
		configPath: string,
		titleKey: string,
		prominent: boolean
	): Observable<ISignInProvider | null> {
		const url = configuredSignInLink(link);
		if (!url) {
			return of(null);
		}
		return this._http.get<{ enabled?: boolean }>(`${API_PREFIX}${configPath}`).pipe(
			map((config) => (config?.enabled === true ? { id, url, titleKey, prominent } : null)),
			catchError(() => of(null))
		);
	}

	/**
	 * Get an array of social links based on application configuration.
	 *
	 * @param {IAppConfig} configs - The application configuration.
	 * @returns {ISocialLink[]} Array of social link objects.
	 */
	getSocialLinks(configs: IAppConfig): ISocialLink[] {
		return [
			{
				url: environment.GOOGLE_AUTH_LINK,
				icon: 'google-outline',
				show: configs.google_login
			},
			{
				url: environment.FACEBOOK_AUTH_LINK,
				icon: 'facebook-outline',
				show: configs.facebook_login
			},
			{
				url: environment.GITHUB_AUTH_LINK,
				icon: 'github-outline',
				show: configs.github_login
			},
			{
				url: environment.TWITTER_AUTH_LINK,
				icon: 'twitter-outline',
				show: configs.twitter_login
			},
			{
				url: environment.LINKEDIN_AUTH_LINK,
				icon: 'linkedin-outline',
				show: configs.linkedin_login
			},
			{
				url: environment.MICROSOFT_AUTH_LINK,
				icon: 'microsoft',
				show: configs.microsoft_login
			}
		].filter((item: ISocialLink) => !!item.show);
	}
}
