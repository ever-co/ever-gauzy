import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { AvatarComponent } from './avatar.component';

@NgModule({
	declarations: [AvatarComponent],
	exports: [AvatarComponent],
	imports: [CommonModule]
})
export class AvatarModule {}
