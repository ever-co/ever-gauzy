import { Component, OnDestroy, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
	selector: 'ngx-share',
	styleUrls: ['share.component.scss'],
	template: `
		<ngx-one-column-layout>
			<router-outlet></router-outlet>
		</ngx-one-column-layout>
	`
})
export class ShareComponent implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();

	constructor(private translate: TranslateService) {}

	async ngOnInit() {
		this._applyTranslationOnSmartTable();
	}

	getTranslation(prefix: string) {
		let result = prefix;
		this.translate.get(prefix).subscribe((res) => {
			result = res;
		});
		return result;
	}

	private _applyTranslationOnSmartTable() {
		this.translate.onLangChange
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
