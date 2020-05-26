import { Component } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';

@Component({
	template: `
		<div class="text-center d-block" *ngIf="!rowData.paid">
			<div class="badge-danger">
				{{ 'INVOICES_PAGE.NOT_PAID' | translate }}
			</div>
		</div>
		<div class="text-center d-block" *ngIf="rowData.paid">
			<div class="badge-success">
				{{ 'INVOICES_PAGE.PAID' | translate }}
			</div>
		</div>
	`,
	styles: []
})
export class InvoicePaidComponent extends TranslationBaseComponent
	implements OnInit {
	constructor(readonly translateService: TranslateService) {
		super(translateService);
	}

	rowData: any;

	ngOnInit() {
		console.log(this.rowData);
	}
}
