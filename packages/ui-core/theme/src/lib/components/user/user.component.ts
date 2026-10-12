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

	/**
	 * Initials to stand in for a missing avatar: the first letter of the first and
	 * last name parts, or of the email when there is no name.
	 */
	initials(user: IUser): string {
		const parts = (user?.name ?? '').trim().split(/\s+/).filter(Boolean);

		if (parts.length) {
			const first = parts[0].charAt(0);
			const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
			return (first + last).toUpperCase();
		}

		return (user?.email ?? '?').charAt(0).toUpperCase();
	}

	onClicked() {
		this.clicked.emit();
	}
}
