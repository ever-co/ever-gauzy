import { Component, Input, OnInit } from '@angular/core';
import { UntilDestroy } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../language-base';


@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gauzy-no-data',
	templateUrl: './no-data.component.html',
	styleUrls: ['./no-data.component.scss']
})
export class NodataComponent extends TranslationBaseComponent implements 
	OnInit {
	
	@Input()
	message: string;

	constructor(
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		
	}
}
