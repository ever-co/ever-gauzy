import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NgxPermissionsService } from 'ngx-permissions';
import { IFeature, IUser } from '@gauzy/contracts';
import { FeatureStoreService, UsersService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { Store } from '@gauzy/ui-core/common';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-onboarding-complete',
	templateUrl: './onboarding-complete.component.html',
	styleUrls: ['./onboarding-complete.component.scss']
})
export class OnboardingCompleteComponent extends TranslationBaseComponent implements OnInit {
	constructor(
		private router: Router,
		public readonly translationService: TranslateService,
		private readonly store: Store,
		private usersService: UsersService,
		private ngxPermissionsService: NgxPermissionsService,
		private readonly _featureStoreService: FeatureStoreService
	) {
		super(translationService);
	}

	blocks$: Observable<IFeature[][]> = this._featureStoreService.blocks$;
	features$: Observable<IFeature[]> = this._featureStoreService.features$;

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
		this._featureStoreService.loadFeatures(['children']).pipe(untilDestroyed(this)).subscribe();
	}

	navigateTo(link: string) {
		const url = `pages/${link}`;
		this.router.navigate([url]);
	}
}
