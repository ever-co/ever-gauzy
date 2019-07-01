import { ThemeModule } from '../../../@theme/theme.module';
import { NgModule } from '@angular/core';
import { BasicInfoFormComponent } from './basic-info/basic-info-form.component';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

@NgModule({
    imports: [
        ThemeModule,
        FormsModule,
        ReactiveFormsModule
    ],
    exports: [BasicInfoFormComponent],
    declarations: [BasicInfoFormComponent],
    entryComponents: [BasicInfoFormComponent]
})
export class UserFormsModule { }
