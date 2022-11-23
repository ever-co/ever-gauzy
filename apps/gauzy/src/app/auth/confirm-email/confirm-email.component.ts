import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy } from '@ngneat/until-destroy';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './confirm-email.component.html'
})
export class ConfirmEmailComponent extends TranslationBaseComponent
	implements OnInit {

	loading: boolean = true;

	constructor(
		public readonly translateService: TranslateService,
	) {
		super(translateService);
	}

	ngOnInit() {}
}
