import { NgModule } from '@angular/core';
import { ThemeModule } from '../../@theme/theme.module';
import { NbCardModule, NbButtonModule, NbInputModule } from '@nebular/theme';
import { FormsModule } from '@angular/forms';
import { IncomeComponent } from './income.component';
import { IncomeRoutingModule } from './income-routing.module';

@NgModule({
    imports: [
        IncomeRoutingModule,
        ThemeModule,
        NbCardModule,
        FormsModule,
        NbButtonModule,
        NbInputModule,
    ],
    declarations: [
        IncomeComponent
    ]
})
export class IncomeModule { }