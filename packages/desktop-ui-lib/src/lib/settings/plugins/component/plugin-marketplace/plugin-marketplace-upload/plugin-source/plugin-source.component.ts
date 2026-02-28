import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PluginOSArch, PluginOSType, PluginSourceType } from '@gauzy/contracts';
import { BasePluginFormComponent } from '../base-plugin-form/base-plugin-form.component';
import { FormSectionComponent } from '../form-section/form-section.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbIconModule, NbSelectModule, NbOptionModule } from '@nebular/theme';
import { FormRowComponent } from '../form-row/form-row.component';
import { NpmFormComponent } from './forms/npm-form/npm-form.component';
import { CdnFormComponent } from './forms/cdn-form/cdn-form.component';
import { GauzyFormComponent } from './forms/gauzy-form/gauzy-form.component';

import { TitleCasePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { NoDataMessageComponent } from '../../../../../../time-tracker/no-data-message/no-data-message.component';

@Component({
    selector: 'lib-plugin-source',
    templateUrl: './plugin-source.component.html',
    styleUrls: ['./plugin-source.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormSectionComponent, FormsModule, ReactiveFormsModule, NbIconModule, FormRowComponent, NbSelectModule, NbOptionModule, NpmFormComponent, CdnFormComponent, GauzyFormComponent, NoDataMessageComponent, TitleCasePipe, TranslatePipe]
})
export class PluginSourceComponent extends BasePluginFormComponent {
	public readonly pluginSourceType = PluginSourceType;
	public readonly sourceTypes = Object.values(PluginSourceType);
	public readonly sourceArchs = Object.values(PluginOSArch);
	public readonly sourceOs = Object.values(PluginOSType);
}
