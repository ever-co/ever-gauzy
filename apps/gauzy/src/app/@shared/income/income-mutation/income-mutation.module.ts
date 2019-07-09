import { NgModule } from '@angular/core';
import { IncomeMutationComponent } from './income-mutation.component';
import { NbCardModule, NbButtonModule } from '@nebular/theme';

@NgModule({
    imports: [
        NbCardModule,
        NbButtonModule
    ],
    exports: [IncomeMutationComponent],
    declarations: [IncomeMutationComponent],
    entryComponents: [IncomeMutationComponent],
    providers: [
    ]
})
export class IncomeMutationModule { }