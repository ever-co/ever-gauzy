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
	@Input() showSelection: boolean = true;

	@Output() planSelected = new EventEmitter<IPlanViewModel>();

	public readonly PluginSubscriptionType = PluginSubscriptionType;

	constructor(public readonly formatter: PlanFormatterService) {}

	public onCardClick(): void {
		this.planSelected.emit(this.plan);
	}

	public getLimitationEntries(): Array<[string, any]> {
		if (!this.plan.limitations) {
			return [];
		}
		return Object.entries(this.plan.limitations).filter(([_, value]) => value != null);
	}
}
