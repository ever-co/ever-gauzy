import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbIconModule, NbButtonModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { AddIconComponent } from './add-icon.component';

@NgModule({
	imports: [CommonModule, NbButtonModule, NbCardModule, NbIconModule, TranslatePipe],
	declarations: [AddIconComponent],
	exports: [AddIconComponent]
})
export class AddIconModule {}
