import {
	Component,
	OnDestroy,
	OnInit,
	Input,
	TemplateRef
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../language-base/translation-base.component';
import { Output, EventEmitter } from '@angular/core';

@Component({
	selector: 'ga-card-grid',
	templateUrl: './card-grid.component.html',
	styleUrls: ['./card-grid.component.scss']
})
export class CardGridComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	@Input() source: any;
	@Input() settings: any = {};
	@Input() buttonTemplate: TemplateRef<any>;
	@Input() cardSize: undefined | 'big';
  @Output() onSelectedItem: EventEmitter<any> = new EventEmitter<any>();

	constructor(
		readonly translationService: TranslateService
	) {
		super(translationService);
	}

	ngOnInit(): void {}

	getKeys() {
    console.log(Object.keys(this.settings.columns));
		return Object.keys(this.settings.columns);
	}

  selectedItem(item){
    this.onSelectedItem.emit({isSelected: true, data: item});
  }
	ngOnDestroy() {}
}
