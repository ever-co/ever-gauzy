import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { IPluginSubscriptionPlan } from '../../../../../services/plugin-subscription.service';

/**
 * Reusable plan card component (Presentational/Dumb Component)
 * Following:
 * - Single Responsibility: Display plan information
 * - Open/Closed: Extensible through inputs/outputs
 * - Interface Segregation: Minimal focused interface
 */
@Component({
	selector: 'gauzy-subscription-plan-card',
	templateUrl: './subscription-plan-card.component.html',
	styleUrls: ['./subscription-plan-card.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: false
})
export class SubscriptionPlanCardComponent {
	@Input() plan: IPluginSubscriptionPlan;
	@Input() isSelected = false;
	@Input() isCurrent = false;
	@Input() isPopular = false;
	@Input() isRecommended = false;
	@Input() canUpgrade = false;
	@Input() canDowngrade = false;
	@Input() priceLabel: string;
	@Input() savingsLabel: string | null;
	@Input() actionLabel: string;
	@Input() showActions = true;
	@Input() disabled = false;

	@Output() planSelected = new EventEmitter<IPluginSubscriptionPlan>();
	@Output() actionClicked = new EventEmitter<IPluginSubscriptionPlan>();

	onPlanClick(): void {
		if (!this.disabled) {
			this.planSelected.emit(this.plan);
		}
	}

	onActionClick(event: Event): void {
		event.stopPropagation();
		if (!this.disabled) {
			this.actionClicked.emit(this.plan);
		}
	}
}
