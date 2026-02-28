import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ID } from '@gauzy/contracts';
import { NbDateService, NbIconModule, NbFormFieldModule, NbInputModule, NbDatepickerModule, NbAlertModule } from '@nebular/theme';
import { BasePluginFormComponent } from '../base-plugin-form/base-plugin-form.component';
import { FormSectionComponent } from '../form-section/form-section.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FormRowComponent } from '../form-row/form-row.component';
import { VersionSelectorComponent } from '../../plugin-marketplace-item/version-selector/version-selector.component';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
    selector: 'lib-plugin-version',
    templateUrl: './plugin-version.component.html',
    styleUrls: ['./plugin-version.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormSectionComponent, FormsModule, ReactiveFormsModule, NbIconModule, FormRowComponent, VersionSelectorComponent, NbFormFieldModule, NbInputModule, NbDatepickerModule, NbAlertModule, TranslatePipe]
})
export class PluginVersionComponent extends BasePluginFormComponent {
	@Input() isEdit = false;
	@Input() pluginId: ID;

	public max: Date;

	constructor(protected dateService: NbDateService<Date>) {
		super();
		this.max = dateService.today();
	}
}
