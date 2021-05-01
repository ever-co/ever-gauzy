import { Component, OnDestroy, OnInit } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../@shared/language-base/translation-base.component';
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-share',
	template: `
		<ga-public-layout>
			<router-outlet></router-outlet>
		</ga-public-layout>
	`
})
export class ShareComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	constructor(public translate: TranslateService) {
		super(translate)
	}

	ngOnInit() {
		this._applyTranslationOnSmartTable();
	}

	private _applyTranslationOnSmartTable() {
		this.translate.onLangChange.pipe(untilDestroyed(this)).subscribe();
	}

	ngOnDestroy() {}
}
