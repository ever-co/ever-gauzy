import { Component, OnDestroy, OnInit } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-share',
	template: `
		<ga-public-layout>
			<router-outlet></router-outlet>
		</ga-public-layout>
	`
})
export class ShareComponent implements OnInit, OnDestroy {
	constructor(private translate: TranslateService) {}

	ngOnInit() {
		this._applyTranslationOnSmartTable();
	}

	getTranslation(prefix: string) {
		let result = prefix;
		this.translate
			.get(prefix)
			.pipe(untilDestroyed(this))
			.subscribe((res) => {
				result = res;
			});
		return result;
	}

	private _applyTranslationOnSmartTable() {
		this.translate.onLangChange.pipe(untilDestroyed(this)).subscribe();
	}

	ngOnDestroy() {}
}
