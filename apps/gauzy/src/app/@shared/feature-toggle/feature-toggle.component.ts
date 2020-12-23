import { Component, Input, OnInit } from '@angular/core';
import { filter, finalize, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	IFeature,
	IFeatureOrganization,
	IOrganization,
	IUser
} from '@gauzy/models';
import { FeatureStoreService } from '../../@core/services/feature/feature-store.service';
import { Store } from '../../@core/services/store.service';
import { Observable } from 'rxjs/Observable';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../language-base/translation-base.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-feature-toggle',
	templateUrl: './feature-toggle.component.html',
	styleUrls: ['./feature-toggle.component.scss']
})
export class FeatureToggleComponent
	extends TranslationBaseComponent
	implements OnInit {
	@Input() organization: IOrganization;

	user: IUser;
	loading: boolean;
	featureOrganizations: IFeatureOrganization[] = [];

	features$: Observable<IFeature[]> = this._featureStoreService.features$;
	blocks$: Observable<IFeature[][]> = this._featureStoreService.blocks$;

	constructor(
		private readonly _featureStoreService: FeatureStoreService,
		readonly translationService: TranslateService,
		private readonly _storeService: Store
	) {
		super(translationService);
	}

	ngOnInit(): void {
		this._storeService.user$
			.pipe(
				filter((user) => !!user),
				tap((user) => (this.user = user)),
				tap(() => (this.loading = true)),
				tap(() => {
					this.getFeatures();
					this.getFeatureOrganizations();
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	getFeatures() {
		this._featureStoreService
			.loadFeatures(['children'])
			.pipe(
				finalize(() => (this.loading = false)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	getFeatureOrganizations() {
		const { tenantId } = this.user;
		this._featureStoreService
			.loadFeatureOrganizations(['feature'], {
				tenantId
			})
			.pipe(untilDestroyed(this))
			.subscribe();
	}

	featureChanged(feature: IFeature, enabled: boolean) {
		const { tenantId } = this.user;
		const request = {
			tenantId,
			featureId: feature.id,
			isEnabled: enabled
		};
		this._featureStoreService
			.changedFeature(request)
			.pipe(tap(() => window.location.reload()))
			.subscribe();
	}
}
