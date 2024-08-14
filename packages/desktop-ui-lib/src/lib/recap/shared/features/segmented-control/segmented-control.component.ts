import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, from } from 'rxjs';
import { SegmentControlService } from './+state/segment-control.service';
import { ISegmentControlState } from './+state/segment-control.store';

@Component({
	selector: 'ngx-segmented-control',
	templateUrl: './segmented-control.component.html',
	styleUrls: ['./segmented-control.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class SegmentedControlComponent implements OnInit {
	@Input()
	public segments: ISegmentControlState[] = [];

	constructor(private readonly segmentControlService: SegmentControlService, private readonly router: Router) {}

	public ngOnInit(): void {
		if (!this.segmentControlService.segment.title) {
			this.segmentControlService.segment = this.segments[0];
		} else {
			from(this.navigate(this.segmentControlService.segment)).subscribe();
		}
	}

	public async onSelect(segment: ISegmentControlState): Promise<void> {
		this.segmentControlService.segment = segment;
		await this.navigate(segment);
	}

	public get segment$(): Observable<ISegmentControlState> {
		return this.segmentControlService.segment$;
	}

	public async navigate(segment: ISegmentControlState): Promise<void> {
		try {
			await this.router.navigate(segment.path);
		} catch (error) {
			console.error(error);
		}
	}
}
