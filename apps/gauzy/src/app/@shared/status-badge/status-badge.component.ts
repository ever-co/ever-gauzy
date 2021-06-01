import { Component, OnInit, Input } from '@angular/core';
import { ComponentLayoutStyleEnum } from '@gauzy/contracts';

@Component({
	selector: 'ga-status-badge',
	templateUrl: './status-badge.component.html',
	styleUrls: ['./status-badge.component.scss']
})
export class StatusBadgeComponent implements OnInit {
	@Input() value: any;
	text: string;
	badgeClass: string;

	@Input()
	layout?: ComponentLayoutStyleEnum | undefined;

	constructor() {}

	ngOnInit() {
		if (this.value) {
			if (this.layout === 'CARDS_GRID') {
				if (typeof this.value === 'object') {
					this.text = this.value['text'];
					this.badgeClass = 'badge badge-' + this.value['class'];
				} else {
					this.text = this.value;
				}
			} else {
				this.text = this.value['text'];
				this.badgeClass = 'badge badge-' + this.value['class'];
			}
		}
	}
}
