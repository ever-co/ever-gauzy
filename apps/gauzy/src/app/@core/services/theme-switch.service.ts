import { Injectable } from "@angular/core";
import { CORPORATE_THEME, COSMIC_THEME, DARK_THEME, DEFAULT_THEME, NbThemeService } from "@nebular/theme";
import { MATERIAL_LIGHT_THEME } from "../../@theme/styles/material/theme.material-light";
import { MATERIAL_DARK_THEME } from "../../@theme/styles/material/theme.material-dark";
import { GAUZY_LIGHT } from "../../@theme/styles/gauzy/theme.gauzy-light";
import { GAUZY_DARK } from "../../@theme/styles/gauzy/theme.gauzy-dark";
import { BehaviorSubject, Observable, Subject } from "rxjs";
import { Store } from "./store.service";


@Injectable()
export class ThemeSwitchService {
  lightMode: Subject<number>
  lightMode$: Observable<number>
  theme: string | null = null
  themes = {
    dark: [GAUZY_DARK.name, DARK_THEME.name, COSMIC_THEME.name, MATERIAL_DARK_THEME.name],
    light: [GAUZY_LIGHT.name, DEFAULT_THEME.name, CORPORATE_THEME.name, MATERIAL_LIGHT_THEME.name],
  }

  constructor (private nbThemeService: NbThemeService, private storeService: Store) {
    this.theme = this.storeService.currentTheme
    this.lightMode = new BehaviorSubject(this.storeService.currentDayNightSwitchValue)
    this.lightMode$ = this.lightMode.asObservable()
  }

  public toggleLightMode() {
    const currentTheme = this.storeService.currentTheme ? this.storeService.currentTheme : GAUZY_LIGHT.name
    let themeIndex = this.themes.dark.findIndex(x => x === currentTheme)
    let isDark = true

    if (themeIndex === -1) {
      themeIndex = this.themes.light.findIndex(x => x === currentTheme)
      isDark = false
    }
    const nextTheme =  isDark ? this.themes.light[themeIndex] : this.themes.dark[themeIndex]
    const nextLightMode = isDark ? 1 : 0

    this.storeService.currentTheme = nextTheme
    this.storeService.currentDayNightSwitchValue = nextLightMode
    this.nbThemeService.changeTheme(nextTheme)
    this.lightMode.next(nextLightMode)
  }

  public initializeThemeMode() {
    this.theme = this.storeService.currentTheme
      ? this.storeService.currentTheme
      : this.storeService.currentDayNightSwitchValue === 1 ? GAUZY_LIGHT.name : GAUZY_DARK.name

    this.nbThemeService.changeTheme(this.theme)
  }
}
