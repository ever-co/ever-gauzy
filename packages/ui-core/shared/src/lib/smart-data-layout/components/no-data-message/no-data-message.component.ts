import { Component, Input, OnInit } from '@angular/core';
import { UntilDestroy } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-no-data-message',
	templateUrl: './no-data-message.component.html',
	styleUrls: ['./no-data-message.component.scss']
})
export class NoDataMessageComponent extends TranslationBaseComponent implements OnInit {
	@Input() title: string = this.getTranslation('SM_TABLE.NO_DATA_MESSAGE');
	@Input() message: string;

	constructor(public readonly translateService: TranslateService) {
		super(translateService);
	}

	ngOnInit() {}
}
