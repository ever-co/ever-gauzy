import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'gauzy-sidebar-menu',
  templateUrl: './sidebar-menu.component.html',
  styleUrls: ['./sidebar-menu.component.scss']
})
export class SidebarMenuComponent implements OnInit {
  @Input() menu: any;
  constructor() { }

  ngOnInit(): void {
    console.log(this.menu)
  }

}
