import { Component, Output, EventEmitter, Input } from '@angular/core';

@Component({
	selector: 'ga-info-block',
	templateUrl: './info-block.component.html',
	styleUrls: ['./info-block.component.scss']
})
export class InfoBlockComponent {
	@Input() title: string;
	@Input() meta: string;
	@Input() value: string;
	@Input() color: string;
	@Input() blockType: boolean;
	@Input() accordion: boolean;
	@Input() listItem: boolean;

	@Output() openInfo = new EventEmitter<void>();

	handleClick = () => {
		this.openInfo.emit();
	};
}
