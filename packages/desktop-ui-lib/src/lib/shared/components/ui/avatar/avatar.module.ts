import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { AvatarComponent } from './avatar.component';

@NgModule({
    exports: [AvatarComponent],
    imports: [CommonModule, AvatarComponent]
})
export class AvatarModule {}
