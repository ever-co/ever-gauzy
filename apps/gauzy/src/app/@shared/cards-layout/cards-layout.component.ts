import { Component, Output, EventEmitter, Input } from '@angular/core';

@Component({
	selector: 'ga-cards-layout',
	templateUrl: './cards-layout.component.html',
	styleUrls: ['./cards-layout.component.scss']
})
export class CardsLayoutComponent {
	@Input() source: any;
	@Input() settings: Object = {};

	@Output() openInfo = new EventEmitter<void>();

	handleClick = () => {
		this.openInfo.emit();
	};
}
