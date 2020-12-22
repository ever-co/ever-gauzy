import { AfterViewInit, Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import * as _ from 'underscore';
import { IFeature, IFeatureOrganization } from '@gauzy/models';
import { FeatureService } from '../../../@core/services/feature.service';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';

@Component({
	selector: 'ga-feature',
	templateUrl: './feature.component.html',
	styleUrls: ['./feature.component.scss']
})
export class FeatureComponent
	extends TranslationBaseComponent
	implements OnInit, AfterViewInit {
	loading: boolean;
	features: IFeature[] = [];
	blocks: IFeature[][] = [];
	featureOrganizations: IFeatureOrganization[] = [];

	constructor(
		readonly translate: TranslateService,
		private readonly featureService: FeatureService
	) {
		super(translate);
	}

	ngOnInit(): void {
		this.getFeatures();
		this.getFeatureOrganizations();
	}

	ngAfterViewInit(): void {}

	getFeatures() {
		this.loading = true;
		this.featureService
			.getFeatures(['children'])
			.then(({ items }) => {
				this.features = items;
				this.blocks = _.chunk(this.features, 2) as Array<IFeature[]>;
			})
			.finally(() => (this.loading = false));
	}

	getFeatureOrganizations() {
		this.featureService.getFeatureOrganizations().then((resp) => {
			console.log(resp);
		});
	}

	featureChanged(row: IFeature, enabled: boolean) {
		console.log(row, enabled);
	}
}
