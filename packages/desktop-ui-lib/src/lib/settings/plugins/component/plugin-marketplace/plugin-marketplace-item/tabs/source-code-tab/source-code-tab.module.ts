import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NbBadgeModule, NbCardModule, NbIconModule, NbTooltipModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { SourceCodeTabComponent } from './source-code-tab.component';

@NgModule({
	declarations: [SourceCodeTabComponent],
	imports: [CommonModule, TranslateModule, NbCardModule, NbIconModule, NbBadgeModule, NbTooltipModule]
})
export class SourceCodeTabModule { }
