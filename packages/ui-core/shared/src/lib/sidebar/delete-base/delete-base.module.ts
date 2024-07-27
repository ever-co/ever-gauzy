import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbIconModule, NbButtonModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { DeleteBaseComponent } from './delete-base.component';

@NgModule({
	imports: [CommonModule, NbButtonModule, NbCardModule, NbIconModule, TranslateModule.forChild()],
	declarations: [DeleteBaseComponent],
	exports: [DeleteBaseComponent]
})
export class DeleteBaseModule {}
