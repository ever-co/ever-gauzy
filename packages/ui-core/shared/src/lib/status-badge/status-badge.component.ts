import { Component, OnInit, Input } from '@angular/core';
import { ComponentLayoutStyleEnum } from '@gauzy/contracts';

@Component({
	selector: 'ga-status-badge',
	templateUrl: './status-badge.component.html',
	styleUrls: ['./status-badge.component.scss']
})
export class StatusBadgeComponent implements OnInit {
	text: string;
	badgeClass: string;

	@Input() value: any;
	@Input() layout?: ComponentLayoutStyleEnum | undefined;

	constructor() {}

	ngOnInit() {
		if (this.value && this.value.text) {
			if (this.layout === ComponentLayoutStyleEnum.CARDS_GRID) {
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
