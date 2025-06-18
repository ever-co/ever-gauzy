import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
	selector: 'plug-sounshot-player-skeleton',
	standalone: false,
	templateUrl: './sounshot-player-skeleton.component.html',
	styleUrl: './sounshot-player-skeleton.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class SounshotPlayerSkeletonComponent {
	@Input() showVolumeControl = true;
	@Input() animate = true;
}
