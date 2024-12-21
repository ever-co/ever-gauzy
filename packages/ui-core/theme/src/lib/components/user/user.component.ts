import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { IUser } from '@gauzy/contracts';
import { filter, map } from 'rxjs/operators';
import { Observable } from 'rxjs';

@Component({
    selector: 'gauzy-user',
    templateUrl: './user.component.html',
    styleUrls: ['./user.component.scss'],
    standalone: false
})
export class UserComponent implements OnInit {
	@Input() showIdentity = false;
	@Input() user$: Observable<IUser>;

	@Output() clicked: EventEmitter<any> = new EventEmitter<boolean>();

	online$: Observable<boolean>;

	constructor() { }

	ngOnInit(): void {
		this.online$ = this.user$.pipe(
			filter((user: IUser) => !!user && !!user.employee),
			map(
				(user: IUser) =>
					user?.employee?.isOnline && !user?.employee?.isAway
			)
		);
	}

	onClicked() {
		this.clicked.emit();
	}
}
