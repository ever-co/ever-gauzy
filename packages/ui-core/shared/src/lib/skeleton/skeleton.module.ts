import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { SkeletonComponent } from './skeleton.component';

@NgModule({
	imports: [CommonModule, TranslateModule.forChild()],
	declarations: [SkeletonComponent],
	exports: [SkeletonComponent]
})
export class SkeletonModule {}
