import { ThemeModule } from '../../../@theme/theme.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { NbCardModule, NbButtonModule, NbIconModule, NbInputModule } from '@nebular/theme';
import { EmployeeSettingMutationComponent } from './employee-setting-mutation.component';

@NgModule({
    imports: [
        ThemeModule,
        FormsModule,
        ReactiveFormsModule,
        NbCardModule,
        NbButtonModule,
        NbIconModule,
        NbInputModule
    ],
    exports: [EmployeeSettingMutationComponent],
    declarations: [EmployeeSettingMutationComponent],
    entryComponents: [EmployeeSettingMutationComponent],
    providers: [
        
    ]
})
export class EmployeeSettingMutationModule { }