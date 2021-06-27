import { fork } from 'child_process';
import { LocalStore } from '@gauzy/desktop-libs';
import path from 'path';

const runServerUI = () => {
    const { uiPath } = prepareServerUi();
    const uiService = fork(uiPath, { silent: true, detached: true});
    uiService.stdout.on('data', (data) => {
        console.log('SERVER UI STATE LOGS -> ', data.toString());
        uiService.unref();
        process.exit(0);
    });
}

const prepareServerUi = (): {
    uiPath: string
} => {
    // const {
    //     apiBaseUrl
    // } = LocalStore.getStore('configs');
    return {
        uiPath: path.join(__dirname, 'ui-server.js')
    };
}

export default function () {
    console.log('Before Run Api Server');
    runServerUI();
}


