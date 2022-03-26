import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeSelectorComponent } from './theme-selector.component';
import { NbSelectModule, NbToggleModule } from '@nebular/theme';
import { TranslateModule } from '../../../../../../@shared/translate/translate.module';
import { SwitchThemeComponent } from './switch-theme/switch-theme.component';



@NgModule({
  declarations: [
    ThemeSelectorComponent,
    SwitchThemeComponent
  ],
  exports: [ThemeSelectorComponent, SwitchThemeComponent],
  imports: [
    CommonModule,
    NbSelectModule,
    NbToggleModule,
    TranslateModule
  ]
})
export class ThemeSelectorModule { }
