import { Component } from '@angular/core';


@Component({
  selector: 'ngx-theme-switch',
  templateUrl: './theme-switch.component.html',
  styleUrls: ['./theme-switch.component.scss'],
})
export class NgxThemeSwitchComponent {
  theme: string = 'dark';

  changeTheme () {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
  }
}
