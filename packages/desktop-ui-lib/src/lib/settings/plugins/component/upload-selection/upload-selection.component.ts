import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { UploadIntent } from '../plugin-marketplace/+state/stores/plugin-upload-intent.store';

@Component({
	selector: 'ngx-upload-selection',
	templateUrl: './upload-selection.component.html',
	styleUrls: ['./upload-selection.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: false
})
export class UploadSelectionComponent {
	private readonly dialogRef = inject(NbDialogRef<UploadSelectionComponent>);

	/**
	 * Handle selection of install plugin locally option
	 */
	public selectInstall(): void {
		this.dialogRef.close(UploadIntent.Install);
	}

	/**
	 * Handle selection of publish plugin to marketplace option
	 */
	public selectPublish(): void {
		this.dialogRef.close(UploadIntent.Publish);
	}

	/**
	 * Handle dialog dismissal
	 */
	public dismiss(): void {
		this.dialogRef.close(null);
	}
}
