import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';

import { IPluginSubscription } from '../../../../services/plugin-subscription.service';
import { IPlanComparisonDisplayInfo, IPlanViewModel } from '../models/plan-view.model';
import { IPlanComparisonResult, PlanActionType, PlanComparisonService } from '../services/plan-comparison.service';

/**
 * Plan card component that shows comparison information
 * Follows SOLID principles for clean, maintainable UI components
 */
@Component({
	selector: 'lib-plan-card-comparison',
	templateUrl: './plan-card-comparison.component.html',
	styleUrls: ['./plan-card-comparison.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: false
})
export class PlanCardComparisonComponent implements OnInit {
	@Input() planViewModel!: IPlanViewModel;
	@Input() currentSubscription: IPluginSubscription | null = null;
	@Input() isSelected = false;

	public comparisonInfo: IPlanComparisonDisplayInfo | null = null;

	// Expose enum to template
	public readonly PlanActionType = PlanActionType;

	constructor(private readonly planComparison: PlanComparisonService) {}

	ngOnInit(): void {
		if (this.planViewModel) {
			this.updateComparisonInfo();
		}
	}

	private updateComparisonInfo(): void {
		const result = this.planComparison.comparePlans(this.currentSubscription, this.planViewModel.originalPlan);
		this.comparisonInfo = this.createDisplayInfo(result);
	}

	private createDisplayInfo(result: IPlanComparisonResult): IPlanComparisonDisplayInfo {
		return {
			actionType: result.actionType,
			actionText: this.planComparison.getActionDescription(result, this.planViewModel.name),
			buttonVariant: this.planComparison.getActionButtonVariant(result),
			isDisabled: this.planComparison.isPlanSelectionDisabled(result),
			canProceed: result.canProceed,
			requiresPayment: result.requiresPayment,
			prorationAmount: result.prorationAmount,
			formattedProrationAmount: result.prorationAmount ? `$${result.prorationAmount.toFixed(2)}` : undefined,
			restrictions: result.restrictions,
			benefits: result.benefits,
			badgeText: this.getBadgeText(result),
			badgeColor: this.getBadgeColor(result)
		};
	}

	private getBadgeText(result: IPlanComparisonResult): string | undefined {
		switch (result.actionType) {
			case PlanActionType.CURRENT:
				return 'Current';
			case PlanActionType.UPGRADE:
				return 'Upgrade';
			case PlanActionType.DOWNGRADE:
				return 'Downgrade';
			default:
				return undefined;
		}
	}

	private getBadgeColor(result: IPlanComparisonResult): string | undefined {
		switch (result.actionType) {
			case PlanActionType.CURRENT:
				return 'info';
			case PlanActionType.UPGRADE:
				return 'success';
			case PlanActionType.DOWNGRADE:
				return 'warning';
			default:
				return undefined;
		}
	}

	public getActionIcon(): string | null {
		if (!this.comparisonInfo) return null;

		switch (this.comparisonInfo.actionType) {
			case PlanActionType.UPGRADE:
				return 'trending-up-outline';
			case PlanActionType.DOWNGRADE:
				return 'trending-down-outline';
			case PlanActionType.NEW:
				return 'plus-circle-outline';
			case PlanActionType.CURRENT:
				return 'checkmark-circle-outline';
			default:
				return null;
		}
	}

	public onPlanSelect(): void {
		if (this.comparisonInfo?.canProceed) {
			// Emit event to parent component
			console.log('Plan selected:', this.planViewModel.name, 'Action:', this.comparisonInfo.actionType);
		}
	}
}
