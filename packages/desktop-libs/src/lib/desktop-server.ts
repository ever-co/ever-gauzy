import { fork } from 'child_process';
import {
    LocalStore
} from './desktop-store';
export async function apiServer(servicePath, envValue) {
	try {
        console.log(envValue);
		const uiService = fork(servicePath.api, { silent: true, env: {
            ...process.env,
            ...envValue
        } });

        LocalStore.updateConfigSetting({
            apiPid: uiService.pid
        })
        
        uiService.stdout.on('data', (data) => {
            const msgData = data.toString()
            console.log('SERVER API STATE LOGS -> ', msgData);
            if (msgData.indexOf('Listening at http') > -1) {
                UiServerTask(servicePath.ui)
            }
            // uiService.unref();
            // process.exit(0);
        });

        uiService.stderr.on('data', (data) => {
			const msgData = data.toString();
			console.log('log error--', msgData);
		});


	} catch (error) {
		console.log('error upload', error);
	}
  }

export async function UiServerTask(uiPath) {
	try {
        const uiService = fork(uiPath, { silent: true});
        LocalStore.updateConfigSetting({
            uiPid: uiService.pid
        })
        uiService.stdout.on('data', (data) => {
            console.log('SERVER UI STATE LOGS -> ', data.toString());
            // uiService.unref();
            // process.exit(0);
        });
	} catch (error) {
		console.log('error upload', error);
	}
}