import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
import { IUser } from '../../../../../../../packages/contracts/dist/user.model';

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
