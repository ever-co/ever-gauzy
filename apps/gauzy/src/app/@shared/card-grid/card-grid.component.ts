import {
	Component,
	OnDestroy,
	OnInit,
	Input,
	TemplateRef
} from '@angular/core';

import { Output, EventEmitter } from '@angular/core';
import { PaginationComponent } from '../pagination/pagination.component';

@Component({
	selector: 'ga-card-grid',
	templateUrl: './card-grid.component.html',
	styleUrls: ['./card-grid.component.scss']
})
export class CardGridComponent
	extends PaginationComponent
	implements OnInit, OnDestroy
{
	@Input() source: any;
	@Input() settings: any = {};
	@Input() buttonTemplate: TemplateRef<any>;
	@Input() cardSize: undefined | 'big';
	@Output() onSelectedItem: EventEmitter<any> = new EventEmitter<any>();
	selected: any = { isSelected: false, data: null };

	constructor() {
		super();
	}

	ngOnInit(): void {}

	getKeys() {
		return Object.keys(this.settings.columns);
	}

	selectedItem(item) {
		this.selected =
			this.selected.data && item.id === this.selected.data.id
				? { isSelected: !this.selected.isSelected, data: item }
				: { isSelected: true, data: item };
		this.onSelectedItem.emit(this.selected);
	}

	onScroll() {
		this.itemsPerPage += 10;
	}

	ngOnDestroy() {}
}
