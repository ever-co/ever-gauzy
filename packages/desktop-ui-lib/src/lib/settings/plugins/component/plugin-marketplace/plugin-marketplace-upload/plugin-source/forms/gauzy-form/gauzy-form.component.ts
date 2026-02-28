import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BasePluginFormComponent } from '../../../base-plugin-form/base-plugin-form.component';
import { FormSectionComponent } from '../../../form-section/form-section.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbIconModule, NbAlertModule } from '@nebular/theme';
import { FileUploadComponent } from '../../../file-upload/file-upload.component';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
    selector: 'lib-gauzy-form',
    templateUrl: './gauzy-form.component.html',
    styleUrl: './gauzy-form.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormSectionComponent, FormsModule, ReactiveFormsModule, NbIconModule, FileUploadComponent, NbAlertModule, TranslatePipe]
})
export class GauzyFormComponent extends BasePluginFormComponent {
	public onFileSelected(file: File | null): void {
		this.form.patchValue({
			file
		});
		this.form.markAsTouched();
		this.form.markAsDirty();
	}

	public removeFile(): void {
		this.onFileSelected(null);
	}
}
