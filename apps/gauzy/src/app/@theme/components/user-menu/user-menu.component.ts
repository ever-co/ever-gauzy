import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
import { IUser } from '@gauzy/contracts';

@Component({
	selector: 'gauzy-user-menu',
	templateUrl: './user-menu.component.html',
	styleUrls: ['./user-menu.component.scss']
})
export class UserMenuComponent implements OnInit {
	@Input() user: IUser;
	@Output() close: EventEmitter<any> = new EventEmitter<any>(null);

	constructor() {}

	ngOnInit(): void {}

	onClick() {
		this.close.emit();
	}
}
