import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { SkeletonComponent } from './skeleton.component';

@NgModule({
	imports: [CommonModule, TranslatePipe],
	declarations: [SkeletonComponent],
	exports: [SkeletonComponent]
})
export class SkeletonModule {}
