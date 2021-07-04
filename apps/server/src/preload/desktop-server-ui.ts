import { spawn } from 'child_process';
import path from 'path';
import { app } from 'electron';
import os from 'os';
const appPath = app.getPath('userData');

const runServerUI = () => {
    try {
        const { uiPath } = prepareServerUi();
        console.log('ui path', uiPath);
        const uiService = spawn(uiPath, { detached: true});
        uiService.stdout.on('data', (data) => {
            console.log('SERVER UI STATE LOGS -> ', data.toString());
        });
    } catch (error) {
        console.log('error on runserverui', error);
    }
}

const prepareServerUi = (): {
    uiPath: string
} => {
    let appName:string = '';
    switch (os.platform()) {
        case 'win32':
            appName = 'gauzy-server.exe';
            break;
        case 'darwin':
            appName = 'gauzy-server';
            break;
        default:
            break;
    }
    return {
        uiPath: path.join(appPath, appName)
    };
}
runServerUI();


