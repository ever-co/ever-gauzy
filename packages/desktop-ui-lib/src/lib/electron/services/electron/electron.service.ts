import { Injectable } from '@angular/core';

import { ipcRenderer } from 'electron';
import * as remote from '@electron/remote';

@Injectable({
  providedIn: 'root'
})
export class ElectronServices {
  ipcRenderer: typeof ipcRenderer;
  remote: typeof remote;
  get isElectron(): boolean {
    return !!(window && window.process && window.process.type);
  }

  constructor() {
    // Conditional imports
    if (this.isElectron) {
      this.ipcRenderer = window.require('electron').ipcRenderer;

      this.remote = window.require('@electron/remote');
    }
  }
}