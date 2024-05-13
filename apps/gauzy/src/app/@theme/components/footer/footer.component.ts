import { Component, Inject, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Store } from '../../../@core/services/store.service';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/shared';
import { IUser } from '@gauzy/contracts';
import { filter, tap } from 'rxjs/operators';
import { GAUZY_ENV } from '../../../@core';
import { Environment } from '../../../../environments/model';

@Component({
	selector: 'ngx-footer',
	styleUrls: ['./footer.component.scss'],
	templateUrl: './footer.component.html'
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

	constructor(
		public translationService: TranslateService,
		private store: Store,
		@Inject(GAUZY_ENV)
		readonly environment: Environment
	) {
		super(translationService);

		this.companyName = environment.COMPANY_NAME;
		this.companySite = environment.COMPANY_SITE;
		this.companyLink = environment.COMPANY_LINK;
		this.companySiteLink = environment.COMPANY_SITE_LINK;
		this.companyGithubLink = environment.COMPANY_GITHUB_LINK;
		this.companyGitlabLink = environment.COMPANY_GITLAB_LINK;
		this.companyFacebookLink = environment.COMPANY_FACEBOOK_LINK;
		this.companyTwitterLink = environment.COMPANY_TWITTER_LINK;
		this.companyLinkedinLink = environment.COMPANY_LINKEDIN_LINK;
	}

	ngOnInit() {
		this.store.user$
			.pipe(
				filter((user) => !!user),
				tap((user: IUser) => (this.user = user))
			)
			.subscribe();
	}
}
