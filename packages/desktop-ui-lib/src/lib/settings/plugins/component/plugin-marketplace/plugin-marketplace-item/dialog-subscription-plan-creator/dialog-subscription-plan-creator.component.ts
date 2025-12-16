import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IPlugin, IPluginPlanCreateInput } from '@gauzy/contracts';
import { NbDialogRef } from '@nebular/theme';
import { PluginSubscriptionFacade } from '../../+state/plugin-subscription.facade';

@Component({
	selector: 'lib-dialog-subscription-plan-creator',
	templateUrl: './dialog-subscription-plan-creator.component.html',
	styleUrls: ['./dialog-subscription-plan-creator.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class DialogSubscriptionPlanCreatorComponent {
	plugin!: IPlugin;
	pluginId!: string;
	plans: IPluginPlanCreateInput[] = [];
	isPlanValid = true;

	private readonly dialogRef = inject(NbDialogRef<DialogSubscriptionPlanCreatorComponent>);
	private readonly subscriptionFacade = inject(PluginSubscriptionFacade);

	onClose(): void {
		this.dialogRef.close();
	}

	onPlansChange(plans: IPluginPlanCreateInput[]): void {
		this.plans = plans;
	}

	onValidationChange(isValid: boolean): void {
		this.isPlanValid = isValid;
	}

	onSaved(): void {
		//TODO: Add logic to save new plans
		if (this.pluginId) {
			this.subscriptionFacade.loadPluginPlans(this.pluginId);
		}
		this.dialogRef.close(true);
	}
}
