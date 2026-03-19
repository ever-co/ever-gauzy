import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
	NbButtonModule,
	NbCardModule,
	NbDialogRef,
	NbIconModule,
	NbRadioModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';

export interface IAppOption {
	labelKey: string;
	descriptionKey: string;
	protocol: string;
	icon: string;
}

export const DESKTOP_APP_OPTIONS: IAppOption[] = [
	{
		labelKey: 'PLUGIN.DIALOG.APP_SELECTOR.DESKTOP',
		descriptionKey: 'PLUGIN.DIALOG.APP_SELECTOR.DESKTOP_DESC',
		protocol: 'gauzy-desktop',
		icon: 'monitor-outline'
	},
	{
		labelKey: 'PLUGIN.DIALOG.APP_SELECTOR.TIMER',
		descriptionKey: 'PLUGIN.DIALOG.APP_SELECTOR.TIMER_DESC',
		protocol: 'gauzy-timer',
		icon: 'clock-outline'
	},
	{
		labelKey: 'PLUGIN.DIALOG.APP_SELECTOR.SERVER',
		descriptionKey: 'PLUGIN.DIALOG.APP_SELECTOR.SERVER_DESC',
		protocol: 'gauzy-server',
		icon: 'hard-drive-outline'
	},
	{
		labelKey: 'PLUGIN.DIALOG.APP_SELECTOR.API_SERVER',
		descriptionKey: 'PLUGIN.DIALOG.APP_SELECTOR.API_SERVER_DESC',
		protocol: 'gauzy-api-server',
		icon: 'code-outline'
	},
	{
		labelKey: 'PLUGIN.DIALOG.APP_SELECTOR.AGENT',
		descriptionKey: 'PLUGIN.DIALOG.APP_SELECTOR.AGENT_DESC',
		protocol: 'gauzy-agent',
		icon: 'person-outline'
	}
];

@Component({
	selector: 'lib-dialog-app-selector',
	templateUrl: './dialog-app-selector.component.html',
	styleUrls: ['./dialog-app-selector.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbCardModule, NbIconModule, NbButtonModule, NbRadioModule, NbTooltipModule, TranslatePipe]
})
export class DialogAppSelectorComponent {
	public readonly apps: IAppOption[] = DESKTOP_APP_OPTIONS;
	public readonly selectedProtocol = signal<string | null>(null);

	constructor(private readonly dialogRef: NbDialogRef<DialogAppSelectorComponent>) {}

	public select(protocol: string): void {
		this.selectedProtocol.set(protocol);
	}

	public confirm(): void {
		this.dialogRef.close(this.selectedProtocol());
	}

	public dismiss(): void {
		this.dialogRef.close(null);
	}
}
