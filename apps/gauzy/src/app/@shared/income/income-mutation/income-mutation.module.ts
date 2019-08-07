import { ThemeModule } from '../../../@theme/theme.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { NbCardModule, NbButtonModule, NbIconModule, NbDatepickerModule, NbInputModule } from '@nebular/theme';
import { IncomeService } from '../../../@core/services/income.service';
import { IncomeMutationComponent } from './income-mutation.component';
import { NgSelectModule } from '@ng-select/ng-select';

@NgModule({
    imports: [
        ThemeModule,
        FormsModule,
        NbCardModule,
        ReactiveFormsModule,
        NbButtonModule,
        NbIconModule,
        NgSelectModule,
        NbDatepickerModule,
        NbInputModule
    ],
    declarations: [IncomeMutationComponent],
    entryComponents: [IncomeMutationComponent],
    providers: [
        IncomeService
    ]
})
export class IncomeMutationModule { }