import { ThemeModule } from '../../../@theme/theme.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { NbCardModule, NbButtonModule, NbIconModule, NbDatepickerModule, NbInputModule, NbSelectModule } from '@nebular/theme';
import { IncomeService } from '../../../@core/services/income.service';
import { IncomeMutationComponent } from './income-mutation.component';
import { NgSelectModule } from '@ng-select/ng-select';
import { OrganizationsService } from '../../../@core/services/organizations.service';

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
        NbInputModule,
        NbSelectModule
    ],
    declarations: [IncomeMutationComponent],
    entryComponents: [IncomeMutationComponent],
    providers: [
        IncomeService,
        OrganizationsService
    ]
})
export class IncomeMutationModule { }