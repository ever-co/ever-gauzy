import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NgxPermissionsService } from 'ngx-permissions';
import { IFeature, IRolePermission } from '@gauzy/contracts';
import { ErrorHandlingService, FeatureStoreService, PermissionsService, Store } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-onboarding-complete',
	templateUrl: './onboarding-complete.component.html',
	styleUrls: ['./onboarding-complete.component.scss']
})
export class OnboardingCompleteComponent extends TranslationBaseComponent implements OnInit {
	blocks$: Observable<IFeature[][]> = this._featureStoreService.blocks$;
	features$: Observable<IFeature[]> = this._featureStoreService.features$;

	constructor(
		translationService: TranslateService,
		private readonly _ngxPermissionsService: NgxPermissionsService,
		private readonly _router: Router,
		private readonly _store: Store,
		private readonly _permissionsService: PermissionsService,
		private readonly _featureStoreService: FeatureStoreService,
		private readonly _errorHandlingService: ErrorHandlingService
	) {
		super(translationService);
	}

	async ngOnInit() {
		const id = this._store.userId;
		if (!id) return;

		try {
			// Get user permissions
			const permissions = await this._permissionsService.getPermissions();

			// Only enabled permissions assign to logged in user
			await this.initializeUiPermissions(permissions.items);
		} catch (error) {
			console.log('Error while initializing UI permissions', error);
			this._errorHandlingService.handleError(error);
		} finally {
			this.getFeatures();
		}
	}

	/**
	 * Initialize UI permissions
	 */
	private async initializeUiPermissions(userRolePermissions: IRolePermission[]) {
		const permissions = userRolePermissions.map(({ permission }) => permission); // Extract permission from role permissions
		this._ngxPermissionsService.flushPermissions(); // Flush permissions
		this._ngxPermissionsService.loadPermissions(permissions); // Load permissions
	}

	/**
	 * Get Features
	 */
	getFeatures() {
		this._featureStoreService.loadFeatures(['children']).pipe(untilDestroyed(this)).subscribe();
	}

	/**
	 * Navigate to the specified link
	 *
	 * @param link The relative link to navigate to.
	 */
	navigateTo(link: string): void {
		// Normalize the link by removing leading or trailing slashes if any
		const normalizedLink = link.replace(/^\/|\/$/g, '');
		// Construct the URL and navigate
		this._router.navigate([`pages/${normalizedLink}`]);
	}
}
