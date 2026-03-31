import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { NbUserModule } from '@nebular/theme';

/** Row data expected by UserCellComponent */
export interface UserCellRow {
	firstName?: string;
	lastName?: string;
	email?: string;
	imageUrl?: string;
	[key: string]: unknown;
}

@Component({
	selector: 'lib-user-cell',
	template: `
		<nb-user [picture]="picture()" [name]="name()" [title]="email()" size="small"></nb-user>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbUserModule]
})
export class UserCellComponent {
	private readonly _rowData = signal<UserCellRow | undefined>(undefined);

	set rowData(value: UserCellRow) {
		this._rowData.set(value);
	}

	readonly name = computed(() => {
		const data = this._rowData();
		const first = data?.firstName || '';
		const last = data?.lastName || '';
		return `${first} ${last}`.trim() || 'Unknown User';
	});

	readonly email = computed(() => this._rowData()?.email || '');

	readonly picture = computed(() => this._rowData()?.imageUrl || '/assets/images/avatars/default-avatar.png');
}
