import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ICamshot } from 'src/lib/shared/models/camshot.model';
import { IActionButton } from 'src/lib/shared/models/action-button.model';

@Component({
	selector: 'plug-camshot-list',
	imports: [CommonModule],
	templateUrl: './camshot-list.component.html',
	styleUrl: './camshot-list.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class CamshotListComponent {
	@Input() camshots: ICamshot[] = [];
	public actions: IActionButton[] = [
		{
			icon: 'download-outline',
			label: 'Download'
		},
		{
			icon: 'restore-outline',
			label: 'Restore'
		},
		{
			icon: 'trash-outline',
			label: 'Delete'
		}
	];
}
