import { Component, OnInit, Input } from '@angular/core';

@Component({
	selector: 'ga-status-badge',
	templateUrl: './status-badge.component.html',
	styleUrls: ['./status-badge.component.scss']
})
export class StatusBadgeComponent implements OnInit {
	@Input() value: object;
	text: string;
	badgeClass: string;

	constructor() {}

	ngOnInit() {
		this.text = this.value['text'];
		this.badgeClass = 'badge badge-' + this.value['class'];
	}
}
