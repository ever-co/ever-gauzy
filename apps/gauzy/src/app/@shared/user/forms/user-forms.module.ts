import { ThemeModule } from '../../../@theme/theme.module';
import { NgModule } from '@angular/core';
import { BasicInfoFormComponent } from './basic-info/basic-info-form.component';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { NbInputModule, NbCardModule, NbDatepickerModule, NbButtonModule } from '@nebular/theme';
import { AuthService } from '../../../@core/services/auth.service';
import { RoleService } from '../../../@core/services/role.service';
import { DeleteConfirmationComponent } from './delete-confirmation/delete-confirmation.component';
import { IncomeService } from '../../../@core/services/income.service';

@NgModule({
    imports: [
        ThemeModule,
        FormsModule,
        ReactiveFormsModule,
        NbInputModule,
        NbCardModule,
        NbDatepickerModule,
        NbButtonModule
    ],
    exports: [BasicInfoFormComponent, DeleteConfirmationComponent],
    declarations: [BasicInfoFormComponent, DeleteConfirmationComponent],
    entryComponents: [BasicInfoFormComponent, DeleteConfirmationComponent],
    providers: [
        AuthService,
        RoleService,
        IncomeService
    ]
})
export class UserFormsModule { }
