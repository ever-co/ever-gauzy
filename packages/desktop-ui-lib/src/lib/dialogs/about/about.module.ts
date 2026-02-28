import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NbButtonModule, NbCardModule, NbLayoutModule } from '@nebular/theme';
import { LanguageModule } from '../../language/language.module';
import { AboutComponent } from './about.component';

@NgModule({
    imports: [CommonModule, NbCardModule, NbButtonModule, NbLayoutModule, LanguageModule.forChild(), AboutComponent]
})
export class AboutModule {}
