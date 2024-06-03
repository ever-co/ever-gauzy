import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Observable, firstValueFrom } from 'rxjs';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import * as _ from 'underscore';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/shared';
import { environment } from '@gauzy/ui-config';
import { IFeature, IFeatureOrganization, IFeatureToggle, IOrganization, IUser } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-sdk/common';
import { FeatureStoreService } from '../../@core/services';
import { CountdownConfirmationComponent } from '../user/forms';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-feature-toggle',
	templateUrl: './feature-toggle.component.html',
	styleUrls: ['./feature-toggle.component.scss']
})
export class FeatureToggleComponent extends TranslationBaseComponent implements OnInit, OnChanges {
	@Input() organization: IOrganization;

	blocks$: Observable<IFeature[][]> = this._featureStoreService.blocks$;

	isOrganization: boolean;
	user: IUser;
	loading: boolean = true;
	featureTenant: IFeatureOrganization[] = [];
	featureOrganizations: IFeatureOrganization[] = [];
	featureTogglesDefinitions: IFeatureToggle[] = [];

	constructor(
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _featureStoreService: FeatureStoreService,
		private readonly _storeService: Store,
		public readonly translationService: TranslateService,
		private readonly dialogService: NbDialogService
	) {
		super(translationService);
	}

	ngOnInit(): void {
		this._activatedRoute.data
			.pipe(
				tap(({ isOrganization }) => (this.isOrganization = isOrganization)),
				untilDestroyed(this)
			)
			.subscribe();
		this._storeService.user$
			.pipe(
				filter((user: IUser) => !!user),
				tap((user: IUser) => (this.user = user)),
				tap(() => this.getFeatures()),
				untilDestroyed(this)
			)
			.subscribe();
		this._storeService.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => (this.loading = true)),
				debounceTime(50),
				tap(() => (this.loading = false)),
				tap(() => this.getFeatureOrganizations()),
				untilDestroyed(this)
			)
			.subscribe();
		this._storeService.featureTenant$
			.pipe(
				tap((value: IFeatureOrganization[]) => (this.featureTenant = value)),
				untilDestroyed(this)
			)
			.subscribe();
		this._featureStoreService.featureOrganizations$
			.pipe(
				tap((value: IFeatureOrganization[]) => {
					this.featureOrganizations = value;
					if (this.organization && this.isOrganization) {
						this._storeService.featureOrganizations = value;
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this._storeService.featureToggles$
			.pipe(
				tap((toggles) => (this.featureTogglesDefinitions = toggles)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnChanges(change: SimpleChanges): void {}

	getFeatures() {
		this._featureStoreService.loadFeatures(['children']).pipe(untilDestroyed(this)).subscribe();
	}

	getFeatureOrganizations() {
		if (!this.user) {
			return;
		}
		const { tenantId } = this.user;
		this._featureStoreService
			.loadFeatureOrganizations(['feature'], {
				tenantId,
				...(this.organization && this.isOrganization
					? {
							organizationId: this.organization.id
					  }
					: {})
			})
			.pipe(untilDestroyed(this))
			.subscribe();
	}

	async featureChanged(isEnabled: boolean, feature: IFeature) {
		const result = await firstValueFrom(
			this.dialogService.open(CountdownConfirmationComponent, {
				context: {
					recordType: feature.description,
					isEnabled: isEnabled
				},
				closeOnBackdropClick: false
			}).onClose
		);

		if (result && result === 'continue') {
			this.emitFeatureToggle(feature, isEnabled);
		} else {
			if (!environment.IS_ELECTRON) {
				window.location.reload();
			}
		}
	}

	emitFeatureToggle(feature: IFeature, isEnabled: boolean) {
		const { tenantId } = this.user;
		const { id: featureId } = feature;
		const request = {
			tenantId,
			featureId,
			isEnabled
		};
		if (this.organization && this.isOrganization) {
			const { id: organizationId } = this.organization;
			request['organizationId'] = organizationId;
		}

		this._featureStoreService
			.changedFeature(request)
			.pipe(
				tap(() => {
					if (!environment.IS_ELECTRON) {
						window.location.reload();
					}
				})
			)
			.subscribe();
	}

	enabledFeature(row: IFeature) {
		let unique: IFeatureOrganization[] = [];
		if (this.isOrganization) {
			unique = [...this.featureOrganizations, ...this.featureTenant];
		} else {
			unique = [...this.featureTenant];
		}

		const filtered: IFeatureOrganization[] = _.uniq(unique, (x) => x.featureId);
		const featureOrganization = filtered.find(
			(featureOrganization: IFeatureOrganization) => featureOrganization.featureId === row.id
		);
		if (featureOrganization && featureOrganization.isEnabled === false) {
			return featureOrganization.isEnabled;
		}

		const featureToggle = this.featureTogglesDefinitions.find((item: IFeatureToggle) => item.name == row.code);
		if (featureToggle) {
			return featureToggle.enabled;
		}
		return true;
	}

	getTranslationFormat(text: string) {
		return text.replace(/ /g, '_').replace(/,|&/g, '').replace(/__/g, '_').toUpperCase();
	}
}
