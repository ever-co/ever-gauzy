import { Component, OnInit, Input } from '@angular/core';
import { Router } from '@angular/router';

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
	@Input() id: string;
	@Input() isOption: boolean;

	// Added for set component value when used for ng2-smart-table renderer.
	@Input() set value(object) {
		for (const key in object) {
			if (Object.prototype.hasOwnProperty.call(object, key)) {
				this[key] = object[key];
			}
		}
	}

	constructor(private router: Router,) {}

	ngOnInit() {}

	edit(id: string) {
		if(id) {
			this.router.navigate([
				'/pages/employees/edit/' + id
			]);
		}	
	}
}
