import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbIconModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { SkeletonModule } from '../../skeleton/skeleton.module';
import { NoDataMessageComponent } from './no-data-message.component';

@NgModule({
	imports: [CommonModule, NbCardModule, NbIconModule, TranslatePipe, SkeletonModule],
	declarations: [NoDataMessageComponent],
	exports: [NoDataMessageComponent]
})
export class NoDataMessageModule {}
