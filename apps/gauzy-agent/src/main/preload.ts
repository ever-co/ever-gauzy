console.log('preload window', window);

import { ipcRenderer } from 'electron';
import './preload/contextBridge';
//
console.log('new changes globalVariable new');
// const variableGlobal = getGlobal('variableGlobal');
(async () => {
	const globalVariable = await ipcRenderer.invoke('getGlobalVariable');
	window.variableGlobal = globalVariable;
	console.log('globalVariable check new', window.variableGlobal);
})();


