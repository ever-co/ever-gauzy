import { Component, Input, OnInit } from '@angular/core';
import { NbMenuService, NbSidebarService } from '@nebular/theme';

import { LayoutService } from '../../../@core/utils';
import { UsersService } from '../../../@core/services/users.service';

@Component({
  selector: 'ngx-header',
  styleUrls: ['./header.component.scss'],
  templateUrl: './header.component.html',
})
export class HeaderComponent implements OnInit {

  @Input() position = 'normal';

  user: any;

  userMenu = [
    { title: 'Profile' },
    { title: 'Log out', link: '/auth/logout' }
  ];

  constructor(private sidebarService: NbSidebarService,
    private menuService: NbMenuService,
    private layoutService: LayoutService,
    private usersService: UsersService,
  ) {
  }

  ngOnInit() {
    this.loadUserData();
  }

  toggleSidebar(): boolean {
    this.sidebarService.toggle(true, 'menu-sidebar');
    this.layoutService.changeLayoutSize();

    return false;
  }

  toggleSettings(): boolean {
    this.sidebarService.toggle(false, 'settings-sidebar');
    return false;
  }

  navigateHome() {
    this.menuService.navigateHome();
    return false;
  }

  private async loadUserData() {
    // TODO use global "Store" class
    const id = localStorage.getItem('userId');
    this.user = await this.usersService.getUserById(id);
  }
}
