import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { IVideo } from '../../models/video.model';

@Component({
	selector: 'plug-video-item',
	templateUrl: './video-item.component.html',
	styleUrl: './video-item.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoItemComponent {
	@Input({ required: true }) video!: IVideo;

	constructor(private readonly router: Router, private readonly route: ActivatedRoute) {}

	public async open({ id }: IVideo): Promise<void> {
		await this.router.navigate([id], { relativeTo: this.route });
	}
}
