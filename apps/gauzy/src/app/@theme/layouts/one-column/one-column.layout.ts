import { Component } from '@angular/core';

// TODO: move layouts into the framework
@Component({
  selector: 'ngx-one-column-layout',
  styleUrls: ['./one-column.layout.scss'],
  template: `
    <nb-layout>
      <nb-layout-header fixed>
        <ngx-header></ngx-header>
      </nb-layout-header>

      <nb-sidebar class="menu-sidebar" tag="menu-sidebar" responsive>
       <!-- TODO add sidebar header <nb-sidebar-header>
        </nb-sidebar-header> -->
        <ng-content select="nb-menu"></ng-content>
      </nb-sidebar>

      <nb-layout-column>
        <ng-content select="router-outlet"></ng-content>
      </nb-layout-column>

      <nb-layout-footer fixed>
        <ngx-footer></ngx-footer>
      </nb-layout-footer>
      <nb-sidebar
      class="settings-sidebar"
      tag="settings-sidebar"
      state="collapsed"
      fixed
      [end]="true"
      >
      <ngx-theme-settings></ngx-theme-settings>
    </nb-sidebar>

    </nb-layout>
  `,
})
export class OneColumnLayoutComponent {
}
