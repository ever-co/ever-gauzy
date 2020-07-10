import {
	Component,
	OnInit,
	Input,
	OnChanges,
	SimpleChanges
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { NbComponentStatus, NbComponentSize } from '@nebular/theme';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';

export type ItemActionControlType = 'add' | 'edit' | 'delete';

export interface ItemActionControl {
	type: ItemActionControlType;
	status?: NbComponentStatus;
	disabled?: any;
	size?: NbComponentSize;
	actionCallback: (index?: number) => void;
	icon?: string;
	name?: string;
}

@Component({
	selector: 'ngx-items-actions',
	templateUrl: './items-actions.component.html',
	styleUrls: ['./items-actions.component.css']
})
export class ItemsActionsComponent extends TranslationBaseComponent
	implements OnInit, OnChanges {
	@Input() config: ItemActionControl[];
	controls: ItemActionControl[];
	private controlsConfig: Omit<ItemActionControl, 'actionCallback'>[] = [
		{
			type: 'add',
			name: 'BUTTONS.SPRINT.CREATE',
			status: 'info',
			icon: 'plus-outline'
		},
		{
			type: 'edit',
			name: 'BUTTONS.SPRINT.EDIT',
			status: 'info',
			icon: 'edit-outline'
		},
		{
			type: 'delete',
			name: 'BUTTONS.SPRINT.DELETE',
			status: 'danger',
			icon: 'trash'
		}
	];

	constructor(readonly translateService: TranslateService) {
		super(translateService);
	}

	ngOnInit(): void {
		this.setActionControls();
	}

	setActionControls() {
		this.controls = this.controlsConfig.map(
			(
				control: Omit<ItemActionControl, 'actionCallback'>,
				index: number
			) => {
				return {
					...control,
					...this.config.find(
						(item: ItemActionControl) => item.type === control.type
					)
				};
			}
		);
	}

	ngOnChanges(changes: SimpleChanges): void {
		this.setActionControls();
	}
}
