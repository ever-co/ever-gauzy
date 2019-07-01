import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { NbMenuService, NbSidebarService } from '@nebular/theme';
import { LayoutService } from '../../../@core/utils';
import { Subject } from 'rxjs';
import { Router, NavigationEnd } from '@angular/router';
import { filter, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'ngx-header',
  styleUrls: ['./header.component.scss'],
  templateUrl: './header.component.html',
})
export class HeaderComponent implements OnInit, OnDestroy {
  @Input() position = 'normal';

  showEmployeesSelector = true;
  showDateSelector = true;

  private _ngDestroy$ = new Subject<void>();

  constructor(private sidebarService: NbSidebarService,
    private menuService: NbMenuService,
    private layoutService: LayoutService,
    private router: Router
  ) { }

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

  ngOnInit(): void {
    this.showSelectors(this.router.url);

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .pipe(takeUntil(this._ngDestroy$))
      .subscribe((e) => {
        this.showSelectors(e['url']);
      });
  }

  ngOnDestroy() {
    this._ngDestroy$.next();
    this._ngDestroy$.complete();
  }

  private showSelectors(url: string) {
    if (url.endsWith('/employees')) {
      this.showEmployeesSelector = false;
      this.showDateSelector = false;
    } else {
      this.showEmployeesSelector = true;
      this.showDateSelector = true;
    }
  }
}
