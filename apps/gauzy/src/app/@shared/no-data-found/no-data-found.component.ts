import { Component, Input, OnInit } from '@angular/core';
import { UntilDestroy } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../language-base';


@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gauzy-no-data-found',
	templateUrl: './no-data-found.component.html',
	styleUrls: ['./no-data-found.component.scss']
})
export class NodataFoundComponent extends TranslationBaseComponent implements 
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
