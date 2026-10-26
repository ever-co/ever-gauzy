import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbIconModule, NbButtonModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { DeleteBaseComponent } from './delete-base.component';

@NgModule({
	imports: [CommonModule, NbButtonModule, NbCardModule, NbIconModule, TranslatePipe],
	declarations: [DeleteBaseComponent],
	exports: [DeleteBaseComponent]
})
export class DeleteBaseModule {}
