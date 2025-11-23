import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ISubscriptionPreviewViewModel } from '../../models/plan-view.model';

/**
 * Presentational component for displaying subscription preview
 * Follows SOLID principle: Single Responsibility - displays preview data only
 */
@Component({
	selector: 'lib-subscription-preview',
	templateUrl: './subscription-preview.component.html',
	styleUrls: ['./subscription-preview.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class SubscriptionPreviewComponent {
	@Input() preview!: ISubscriptionPreviewViewModel | null;
}
