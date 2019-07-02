import { ThemeModule } from '../../../@theme/theme.module';
import { NgModule } from '@angular/core';
import { BasicInfoFormComponent } from './basic-info/basic-info-form.component';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { NbInputModule, NbCardModule } from '@nebular/theme';
import { AuthService } from '../../../@core/services/auth.service';
import { RoleService } from '../../../@core/services/role.service';

@NgModule({
    imports: [
        ThemeModule,
        FormsModule,
        ReactiveFormsModule,
        NbInputModule,
        NbCardModule,
    ],
    exports: [BasicInfoFormComponent],
    declarations: [BasicInfoFormComponent],
    entryComponents: [BasicInfoFormComponent],
    providers: [
        AuthService,
        RoleService
    ]
})
export class UserFormsModule { }
