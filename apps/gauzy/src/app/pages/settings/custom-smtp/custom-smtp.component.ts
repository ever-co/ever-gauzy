import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
@Component({
	selector: 'ga-tenant-custom-smtp',
	templateUrl: './custom-smtp.component.html',
	styleUrls: ['./custom-smtp.component.css']
})
export class CustomSmtpComponent
	extends TranslationBaseComponent
	implements OnInit {
	constructor(public readonly translateService: TranslateService) {
		super(translateService);
	}

	ngOnInit(): void {}
}
