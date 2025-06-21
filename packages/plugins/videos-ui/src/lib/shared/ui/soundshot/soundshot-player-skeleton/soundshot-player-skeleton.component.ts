import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
	selector: 'plug-soundshot-player-skeleton',
	standalone: false,
	templateUrl: './soundshot-player-skeleton.component.html',
	styleUrl: './soundshot-player-skeleton.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class SoundshotPlayerSkeletonComponent {
	@Input() showVolumeControl = true;
	@Input() animate = true;
}
