import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { IUser } from '@gauzy/contracts';

@Component({
	selector: 'gauzy-user',
	templateUrl: './user.component.html',
	styleUrls: ['./user.component.scss']
})
export class UserComponent implements OnInit {
	@Input() showIdentity: boolean = false;
	@Input() user: IUser;

	@Output() clicked: EventEmitter<any> = new EventEmitter<boolean>();

	constructor() {}

	ngOnInit(): void {}

	onClicked() {
		this.clicked.emit();
	}
}
