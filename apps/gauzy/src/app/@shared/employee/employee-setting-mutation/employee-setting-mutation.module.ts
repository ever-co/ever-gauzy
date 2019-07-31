import { ThemeModule } from '../../../@theme/theme.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { NbCardModule, NbButtonModule, NbIconModule, NbInputModule, NbDatepickerModule } from '@nebular/theme';
import { EmployeeSettingMutationComponent } from './employee-setting-mutation.component';
import { NgSelectModule } from '@ng-select/ng-select';

@NgModule({
    imports: [
        ThemeModule,
        FormsModule,
        ReactiveFormsModule,
        NbCardModule,
        NbButtonModule,
        NbIconModule,
        NbInputModule,
        NbDatepickerModule,
        NgSelectModule
    ],
    exports: [EmployeeSettingMutationComponent],
    declarations: [EmployeeSettingMutationComponent],
    entryComponents: [EmployeeSettingMutationComponent],
    providers: [
        
    ]
})
export class EmployeeSettingMutationModule { }