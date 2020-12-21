import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IFeature, IUser } from '@gauzy/models';
import { TranslateService } from '@ngx-translate/core';
import { NgxPermissionsService } from 'ngx-permissions';
import * as _ from 'underscore';
import { UsersService } from '../../@core/services';
import { FeatureService } from '../../@core/services/feature.service';
import { Store } from '../../@core/services/store.service';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';

@Component({
	selector: 'ga-onboarding-complete',
	templateUrl: './onboarding-complete.component.html',
	styleUrls: ['./onboarding-complete.component.scss']
})
export class OnboardingCompleteComponent
	extends TranslationBaseComponent
	implements OnInit {
	constructor(
		private router: Router,
		public readonly translationService: TranslateService,
		private readonly store: Store,
		private usersService: UsersService,
		private ngxPermissionsService: NgxPermissionsService,
		private featureService: FeatureService
	) {
		super(translationService);
	}

	blocks: IFeature[][] = [];
	features: IFeature[] = [];

	ngOnInit() {
		const id = this.store.userId;
		if (!id) return;

		this.usersService
			.getMe(['role', 'role.rolePermissions', 'tenant'])
			.then((user: IUser) => {
				//only enabled permissions assign to logged in user
				const permissions = user.role.rolePermissions
					.filter(({ enabled }) => enabled)
					.map(({ permission }) => permission);
				this.ngxPermissionsService.loadPermissions(permissions);
			})
			.catch()
			.finally(() => this.getFeatures());
	}

	getFeatures() {
		this.featureService.getFeatures().then(({ items }) => {
			this.features = items;
			this.blocks = _.chunk(this.features, 2) as Array<IFeature[]>;
		});
	}

	navigateTo(link: string) {
		const url = `pages/${link}`;
		this.router.navigate([url]);
	}
}
