import { CommonModule } from '@angular/common';
import { NgModule, inject, provideAppInitializer } from '@angular/core';
import { ElectronService } from '../electron/services';
import {
    NbThemeModule,
    NbThemeService
} from '@nebular/theme';
import { ThemeInitializerFactory } from './theme-initializer.factory';
import {
    GAUZY_DARK,
    GAUZY_LIGHT
} from './styles';

@NgModule({
    declarations: [],
    imports: [
        CommonModule,
        NbThemeModule.forRoot({ name: GAUZY_LIGHT.name }, [
            GAUZY_LIGHT,
            GAUZY_DARK
        ])
    ],
    providers: [
        NbThemeService,
        provideAppInitializer(() => {
        const initializerFn = (ThemeInitializerFactory)(inject(NbThemeService), inject(ElectronService));
        return initializerFn();
      })
    ],
    exports: [NbThemeModule]
})
export class NgxDesktopThemeModule { }
