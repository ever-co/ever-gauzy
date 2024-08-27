import { CommonModule } from '@angular/common';
import { APP_INITIALIZER, NgModule } from '@angular/core';
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
        {
            provide: APP_INITIALIZER,
            useFactory: ThemeInitializerFactory,
            deps: [NbThemeService, ElectronService],
            multi: true
        }
    ],
    exports: [NbThemeModule]
})
export class NgxDesktopThemeModule { }
