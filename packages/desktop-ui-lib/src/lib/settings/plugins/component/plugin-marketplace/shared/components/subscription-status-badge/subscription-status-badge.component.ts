import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { IPluginSubscription } from '../../../../../services/plugin-subscription.service';
import { NbIconModule, NbBadgeModule } from '@nebular/theme';

/**
 * Reusable subscription status badge component
 * Following Single Responsibility Principle
 */
@Component({
    selector: 'gauzy-subscription-status-badge',
    templateUrl: './subscription-status-badge.component.html',
    styleUrls: ['./subscription-status-badge.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [NbIconModule, NbBadgeModule]
})
export class SubscriptionStatusBadgeComponent {
	@Input() subscription: IPluginSubscription;
	@Input() icon: string;
	@Input() badgeStatus: string;
	@Input() statusText: string;
	@Input() showIcon = true;
}
