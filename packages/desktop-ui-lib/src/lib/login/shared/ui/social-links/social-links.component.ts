import { Component, OnInit } from '@angular/core';
import { UntilDestroy } from '@ngneat/until-destroy';
import { Observable, of } from 'rxjs';
import { socialLinks } from '../../../../auth';

/**
 * Interface representing a social link.
 */
export interface ISocialLink {
	/** The URL of the social link. */
	url: string;
	/** The icon associated with the social link. */
	icon: string;
	/** (Optional) The target attribute for the link. */
	target?: string;
	/** (Optional) The link attribute for the link. */
	link?: string;
	/** (Optional) The title attribute for the link. */
	title?: string;
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

	/**
	 * Lifecycle hook called after Angular has initialized all data-bound properties of a directive.
	 * Called once after the first ngOnChanges().
	 */
	ngOnInit(): void {
		this.socialLinks$ = of(socialLinks);
	}
}
