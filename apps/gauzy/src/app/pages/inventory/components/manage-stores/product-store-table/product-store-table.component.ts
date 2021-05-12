import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { UntilDestroy } from '@ngneat/until-destroy';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@UntilDestroy()
@Component({
	selector: 'ga-product-store-table',
	templateUrl: './product-store-table.component.html',
	styleUrls: ['./product-store-table.component.scss']
})
export class ProductStoreTableComponent
	extends TranslationBaseComponent
	implements OnInit {


	constructor(
		readonly translateService: TranslateService,
		private router: Router,
	) {
		super(translateService);
	}

	ngOnInit(): void {

	}

	onAddStoreClick() {
		this.router.navigate(['/pages/organization/inventory/stores/create']);
	}



}
