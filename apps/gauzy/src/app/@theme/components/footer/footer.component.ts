import { Component } from '@angular/core';
import { environment } from 'apps/gauzy/src/environments/environment';

@Component({
	selector: 'ngx-footer',
	styleUrls: ['./footer.component.scss'],
	templateUrl: './footer.component.html'
})
export class FooterComponent {
	companyName: string;
	companySiteLink: string;
	companyGithubLink: string;
	companyFacebookLink: string;
	companyTwitterLink: string;
	companyLinkedinLink: string;

	constructor() {
		this.companyName = environment.COMPANY_NAME;
		this.companySiteLink = environment.COMPANY_SITE_LINK;
		this.companyGithubLink = environment.COMPANY_GITHUB_LINK;
		this.companyFacebookLink = environment.COMPANY_FACEBOOK_LINK;
		this.companyTwitterLink = environment.COMPANY_TWITTER_LINK;
		this.companyLinkedinLink = environment.COMPANY_LINKEDIN_LINK;
	}
}
