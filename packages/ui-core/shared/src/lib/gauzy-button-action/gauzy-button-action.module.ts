import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbIconModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { GauzyButtonActionComponent } from './gauzy-button-action.component';
import { ComponentsModule } from '../components/components.module';

@NgModule({
	imports: [CommonModule, NbButtonModule, NbIconModule, TranslateModule.forChild(), ComponentsModule],
	declarations: [GauzyButtonActionComponent],
	exports: [GauzyButtonActionComponent]
})
export class GauzyButtonActionModule {}
