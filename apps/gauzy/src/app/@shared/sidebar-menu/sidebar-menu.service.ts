import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SidebarMenuService {
  private _selectedItem: any;
  constructor() { }

  public get selectedItem(): any {
    return this._selectedItem;
  }

  public set selectedItem(value: any) {
    this._selectedItem = value;
  }
}
