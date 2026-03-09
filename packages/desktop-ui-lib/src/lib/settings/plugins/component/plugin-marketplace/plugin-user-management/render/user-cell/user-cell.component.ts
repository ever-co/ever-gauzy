import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NbUserModule } from '@nebular/theme';

@Component({
	selector: 'lib-user-cell',
	template: `
		<nb-user [picture]="picture" [name]="name" [title]="email" size="small"></nb-user>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbUserModule]
})
export class UserCellComponent {
	public rowData: any;

	get name(): string {
		const first = this.rowData?.firstName || '';
		const last = this.rowData?.lastName || '';
		return `${first} ${last}`.trim() || 'Unknown User';
	}

	get email(): string {
		return this.rowData?.email || '';
	}

	get picture(): string {
		return this.rowData?.imageUrl || '/assets/images/avatars/default-avatar.png';
	}
}
