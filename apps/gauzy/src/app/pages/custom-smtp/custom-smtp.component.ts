import { Component, OnInit } from '@angular/core';
import { IOrganization } from '@gauzy/models';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { filter, tap } from 'rxjs/operators';
import { Store } from '../../@core/services/store.service';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-organization-custom-smtp',
	templateUrl: './custom-smtp.component.html',
	styleUrls: ['./custom-smtp.component.css']
})
export class CustomSmtpComponent
	extends TranslationBaseComponent
	implements OnInit {
	organization: IOrganization;

	constructor(
		public readonly translateService: TranslateService,
		private readonly store: Store
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				tap((organization) => (this.organization = organization)),
				untilDestroyed(this)
			)
			.subscribe();
	}
}
