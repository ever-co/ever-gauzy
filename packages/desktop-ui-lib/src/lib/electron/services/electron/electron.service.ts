import { Injectable } from '@angular/core';

import { ipcRenderer, desktopCapturer } from 'electron';
import * as remote from '@electron/remote';

@Injectable()
export class ElectronService {
  ipcRenderer: typeof ipcRenderer;
  remote: typeof remote;
  desktopCapturer: typeof desktopCapturer;

  get isElectron(): boolean {
    return !!(window && window.process && window.process.type);
  }

  constructor() {
    // Conditional imports
    if (this.isElectron) {
      this.ipcRenderer = window.require('electron').ipcRenderer;
      this.remote = window.require('@electron/remote');
	  this.desktopCapturer = window.require('electron').desktopCapturer;
    }
  }
}
