import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { PluginSubscriptionType } from '../../../../../services/plugin-subscription.service';
import { IPlanViewModel } from '../../models/plan-view.model';
import { PlanFormatterService } from '../../services/plan-formatter.service';

/**
 * Presentational component for displaying a subscription plan card
 * Follows SOLID principle: Single Responsibility - displays plan data only
 * Follows SOLID principle: Open/Closed - can be extended without modification
 */
@Component({
	selector: 'lib-plan-card',
	templateUrl: './plan-card.component.html',
	styleUrls: ['./plan-card.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlanCardComponent {
	@Input() plan!: IPlanViewModel;
	@Input() isSelected: boolean = false;
	@Input() isCurrentPlan: boolean = false;
	@Input() isDisabled: boolean = false;
	@Input() showSelection: boolean = true;

	@Output() planSelected = new EventEmitter<IPlanViewModel>();

	public readonly PluginSubscriptionType = PluginSubscriptionType;

	constructor(public readonly formatter: PlanFormatterService) {}

	public onCardClick(): void {
		// Don't allow selection if this is the current plan
		if (this.isDisabled || this.isCurrentPlan) {
			return;
		}
		this.planSelected.emit(this.plan);
	}

	/**
	 * Handle keyboard navigation for accessibility
	 */
	public onKeyDown(event: KeyboardEvent): void {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			this.onCardClick();
		}
	}

	public hasLimitations(): boolean {
		return this.plan.limitations != null && Object.values(this.plan.limitations).some((value) => value != null);
	}

	public getLimitationEntries(): Array<[string, any]> {
		if (!this.plan.limitations) {
			return [];
		}
		return Object.entries(this.plan.limitations).filter(([_, value]) => value != null);
	}
}
