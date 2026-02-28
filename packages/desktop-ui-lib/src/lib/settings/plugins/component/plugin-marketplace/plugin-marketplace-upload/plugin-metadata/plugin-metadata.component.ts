import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BasePluginFormComponent } from '../base-plugin-form/base-plugin-form.component';
import { FormSectionComponent } from '../form-section/form-section.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbIconModule, NbFormFieldModule, NbInputModule, NbAlertModule } from '@nebular/theme';
import { FormRowComponent } from '../form-row/form-row.component';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
    selector: 'lib-plugin-metadata',
    templateUrl: './plugin-metadata.component.html',
    styleUrls: ['./plugin-metadata.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormSectionComponent, FormsModule, ReactiveFormsModule, NbIconModule, FormRowComponent, NbFormFieldModule, NbInputModule, NbAlertModule, TranslatePipe]
})
export class PluginMetadataComponent extends BasePluginFormComponent {}
