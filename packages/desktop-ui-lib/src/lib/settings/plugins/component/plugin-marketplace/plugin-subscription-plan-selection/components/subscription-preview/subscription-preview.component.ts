import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ISubscriptionPreviewViewModel } from '../../models/plan-view.model';
import { NbCardModule, NbIconModule } from '@nebular/theme';

/**
 * Presentational component for displaying subscription preview
 * Follows SOLID principle: Single Responsibility - displays preview data only
 */
@Component({
    selector: 'lib-subscription-preview',
    templateUrl: './subscription-preview.component.html',
    styleUrls: ['./subscription-preview.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [NbCardModule, NbIconModule]
})
export class SubscriptionPreviewComponent {
	@Input() preview!: ISubscriptionPreviewViewModel | null;
}
