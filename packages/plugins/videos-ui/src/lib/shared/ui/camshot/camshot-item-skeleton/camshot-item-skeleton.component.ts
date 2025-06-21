import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
	selector: 'plug-camshot-item-skeleton',
	templateUrl: './camshot-item-skeleton.component.html',
	styleUrl: './camshot-item-skeleton.component.scss',
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class CamshotItemSkeletonComponent {}
