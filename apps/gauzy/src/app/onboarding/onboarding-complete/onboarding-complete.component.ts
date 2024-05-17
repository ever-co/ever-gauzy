import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IFeature, IUser } from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { NgxPermissionsService } from 'ngx-permissions';
import { UsersService } from '../../@core/services';
import { FeatureStoreService } from '../../@core/services/feature/feature-store.service';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/shared';
import { Store } from '../../@core/services/store.service';
import { Observable } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

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
