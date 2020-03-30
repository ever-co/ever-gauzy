import { Component, OnInit } from '@angular/core';
import { LocalDataSource } from 'ng2-smart-table';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';

@Component({
	selector: 'ngx-invoice-item',
	templateUrl: './invoice-item.component.html',
	styleUrls: ['./invoice-item.component.scss']
})
export class InvoiceItemComponent extends TranslationBaseComponent
	implements OnInit {
	settingsSmartTable: object;
	smartTableSource = new LocalDataSource();

	constructor(readonly translateService: TranslateService) {
		super(translateService);
	}

	ngOnInit() {}
}
