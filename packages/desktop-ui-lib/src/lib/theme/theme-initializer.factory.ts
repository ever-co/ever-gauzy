import { NbThemeService } from '@nebular/theme';
import { ElectronService } from '../electron/services';

const themes = {
    light: 'gauzy-light',
    dark: 'gauzy-dark'
}
export function ThemeInitializerFactory(
    themeService: NbThemeService,
    electronService: ElectronService
) {
    return async () => {
        const theme = await electronService?.ipcRenderer?.invoke(
            'PREFERRED_THEME'
        );
        themeService.changeTheme(themes[theme]);
        try {
            electronService?.ipcRenderer?.removeAllListeners('THEME_CHANGE');
            electronService?.ipcRenderer?.on('THEME_CHANGE', (_, theme) => {
                themeService.changeTheme(themes[theme]);
            })
        } catch (error) {
            console.log('error in theme change', error);
        }
    };
}
