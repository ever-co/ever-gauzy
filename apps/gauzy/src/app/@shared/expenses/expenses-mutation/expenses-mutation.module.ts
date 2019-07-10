import { ThemeModule } from '../../../@theme/theme.module';
import { FormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { NbCardModule, NbButtonModule, NbIconModule } from '@nebular/theme';
import { UserFormsModule } from '../../user/forms/user-forms.module';
import { ExpensesMutationComponent } from './expenses-mutation.component';

@NgModule({
    imports: [
        ThemeModule,
        FormsModule,
        NbCardModule,
        UserFormsModule,
        NbButtonModule,
        NbIconModule
    ],
    exports: [ExpensesMutationComponent],
    declarations: [ExpensesMutationComponent],
    entryComponents: [ExpensesMutationComponent],
    providers: [
    ]
})
export class ExpensesMutationModule { }