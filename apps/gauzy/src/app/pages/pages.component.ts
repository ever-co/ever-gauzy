import { Component } from '@angular/core';

import { AuthService } from '../@core/services/auth.service';
import { RolesEnum } from '@gauzy/models';
import { first } from 'rxjs/operators';
import { NbMenuItem } from '@nebular/theme';
import { DEFAULT_MENU_ITEMS, ADMIN_MENU_ITEMS } from './pages-menu';

@Component({
  selector: 'ngx-pages',
  styleUrls: ['pages.component.scss'],
  template: `
    <ngx-one-column-layout>
      <nb-menu [items]="menu"></nb-menu>
      <router-outlet></router-outlet>
    </ngx-one-column-layout>
  `,
})
export class PagesComponent {
  menu: NbMenuItem[] = DEFAULT_MENU_ITEMS;

  constructor(
    private authService: AuthService
  ) {
    this.loadItems();
  }

  private async loadItems() {
    const isAdmin = await this.authService.hasRole([RolesEnum.ADMIN])
      .pipe(first()).toPromise();

    if (isAdmin) {
      this.menu = [...this.menu, ...ADMIN_MENU_ITEMS];
    }
  }
}
