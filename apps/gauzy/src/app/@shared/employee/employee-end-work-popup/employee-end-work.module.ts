import { ThemeModule } from '../../../@theme/theme.module';
import { FormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { NbCardModule, NbButtonModule, NbIconModule, NbDatepickerModule, NbInputModule } from '@nebular/theme';
import { UserFormsModule } from '../../user/forms/user-forms.module';
import { EmployeeEndWorkComponent } from './employee-end-work.component';

@NgModule({
    imports: [
        ThemeModule,
        FormsModule,
        NbCardModule,
        UserFormsModule,
        NbButtonModule,
        NbIconModule,
        NbDatepickerModule,
        NbInputModule
    ],
    exports: [EmployeeEndWorkComponent],
    declarations: [EmployeeEndWorkComponent],
    entryComponents: [EmployeeEndWorkComponent],
    providers: [
    ]
})
export class EmployeeEndWorkModule { }