import { NgModule } from '@angular/core';
import { RemoveLodashPipe } from './remove-lodash.pipe';

@NgModule({
    declarations: [RemoveLodashPipe],
    exports: [RemoveLodashPipe]
})
export class RemoveLodashModule { }