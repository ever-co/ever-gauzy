import { Component, OnInit, Input } from '@angular/core';

@Component({
	selector: 'ngx-avatar',
	templateUrl: './avatar.component.html',
	styleUrls: ['./avatar.component.scss']
})
export class AvatarComponent implements OnInit {
	@Input() size: 'lg' | 'sm' | 'md' = 'md';
	@Input() src: string;
	@Input() name: string;
	@Input() caption: string;

	// Added for set component value when used for ng2-smart-table renderer.
	@Input() set value(object) {
		for (const key in object) {
			if (Object.prototype.hasOwnProperty.call(object, key)) {
				this[key] = object[key];
			}
		}
	}

	constructor() {}

	ngOnInit() {}
}
