import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IPlugin, IPluginPlanCreateInput } from '@gauzy/contracts';
import { NbDialogRef } from '@nebular/theme';
import { filter, pairwise, take } from 'rxjs';
import { PluginPlanActions } from '../../+state/actions/plugin-plan.action';
import { PluginPlanQuery } from '../../+state/queries/plugin-plan.query';

@Component({
	selector: 'lib-dialog-subscription-plan-creator',
	templateUrl: './dialog-subscription-plan-creator.component.html',
	styleUrls: ['./dialog-subscription-plan-creator.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class DialogSubscriptionPlanCreatorComponent {
	public readonly plugin!: IPlugin;
	public readonly pluginId!: string;
	public plans: IPluginPlanCreateInput[] = [];
	public isPlanValid = true;

	private readonly dialogRef = inject(NbDialogRef<DialogSubscriptionPlanCreatorComponent>);
	private readonly planQuery = inject(PluginPlanQuery);

	public onClose(): void {
		this.dialogRef.close();
	}

	public onPlansChange(plans: IPluginPlanCreateInput[]): void {
		this.plans = plans;
	}

	public onValidationChange(isValid: boolean): void {
		this.isPlanValid = isValid;
	}

	public get creating$() {
		return this.planQuery.creating$;
	}

	public onSaved(): void {
		PluginPlanActions.bulkCreatePlans(this.plans);
		this.creating$
			.pipe(
				pairwise(),
				filter(([wasCreating, isCreating]) => wasCreating && !isCreating),
				take(1)
			)
			.subscribe(() => this.dialogRef.close(true));
	}
}
