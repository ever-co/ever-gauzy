import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { IUser } from '@gauzy/contracts';
import { of as ObservableOf } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';

@Component({
	selector: 'gauzy-user',
	templateUrl: './user.component.html',
	styleUrls: ['./user.component.scss']
})
export class UserComponent implements OnInit {
	@Input() showIdentity: boolean = false;
	@Input() user: IUser;

	@Output() clicked: EventEmitter<any> = new EventEmitter<boolean>();

	online$: Observable<boolean>;

	constructor() { }

	ngOnInit(): void {
		this.online$ = ObservableOf(this.user).pipe(
			filter((user: IUser) => !!user && !!user.employee),
			map((user: IUser) => user?.employee?.isOnline),
		);
	}

	onClicked() {
		this.clicked.emit();
	}
}
