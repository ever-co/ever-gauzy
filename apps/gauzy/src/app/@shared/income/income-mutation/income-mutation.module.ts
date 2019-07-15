import { NgModule } from '@angular/core';
import { IncomeMutationComponent } from './income-mutation.component';
import { NbCardModule, NbButtonModule } from '@nebular/theme';
import { IncomeService } from '../../../@core/services/income.service';

@NgModule({
    imports: [
        NbCardModule,
        NbButtonModule
    ],
    exports: [IncomeMutationComponent],
    declarations: [IncomeMutationComponent],
    entryComponents: [IncomeMutationComponent],
    providers: [IncomeService]
})
export class IncomeMutationModule { }