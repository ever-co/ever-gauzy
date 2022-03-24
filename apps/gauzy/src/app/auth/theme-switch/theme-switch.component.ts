import { Component, OnInit } from '@angular/core';
import { NbThemeService } from "@nebular/theme";
import { ThemeSwitchService } from "../../@core";


@Component({
  selector: 'ngx-theme-switch',
  templateUrl: './theme-switch.component.html',
  styleUrls: ['./theme-switch.component.scss'],
})
export class NgxThemeSwitchComponent implements OnInit {
  lightMode: number;

  constructor (private nbThemeService: NbThemeService, private themeSwitchService: ThemeSwitchService) {}

  applyTheme() {
    this.themeSwitchService.toggleLightMode()
  }
  ngOnInit () {
    this.themeSwitchService.lightMode$.subscribe(x => this.lightMode = x)
  }
}
