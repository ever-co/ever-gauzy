import { Component, OnInit } from '@angular/core';
import { environment } from '@gauzy/ui-config';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { IAppConfig } from '@gauzy/contracts';
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
}

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-social-links',
	templateUrl: './social-links.component.html',
	styleUrls: ['./social-links.component.scss']
})
export class SocialLinksComponent implements OnInit {
	/** */
	public socialLinks$: Observable<ISocialLink[]>; // Observable for an array of social links
	public configs: IAppConfig;

	constructor(private readonly _appService: AppService) {}

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
				icon: 'grid',
				show: configs.microsoft_login
			}
		].filter((item: ISocialLink) => !!item.show);
	}
}
