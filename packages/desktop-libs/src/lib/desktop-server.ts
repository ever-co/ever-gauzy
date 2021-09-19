import { fork } from 'child_process';
import { app } from 'electron';
import Sudoer from 'electron-sudo';
import {
    LocalStore
} from './desktop-store';
export async function apiServer(servicePath, envValue, serverWindow, uiPort) {
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
            if (msgData.indexOf('Listening at http') > -1) {
                UiServerTask(servicePath.ui, serverWindow, uiPort.toString())
            }
            serverWindow.webContents.send('log_state', { msg: msgData });
        });

        uiService.stderr.on('data', (data) => {
			const msgData = data.toString();
            serverWindow.webContents.send('log_state', { msg: msgData });
			console.log('log error--', msgData);
		});


	} catch (error) {
        serverWindow.webContents.send('log_state', { msg: error.message });
	}
  }

export async function UiServerTask(uiPath, serverWindow, uiPort) {
	try {
        const uiService = fork(uiPath, { silent: true, env: {
            ...process.env,
            isPackaged: app.isPackaged.toString(),
            uiPort
        } });
        LocalStore.updateConfigSetting({
            uiPid: uiService.pid
        })
        uiService.stdout.on('data', (data) => {
            const msgLog = data.toString();
            console.log('SERVER UI STATE LOGS -> ', msgLog);
            if (msgLog.indexOf('listen ui on port') > -1) {
                serverWindow.webContents.send('running_state', true);
                serverWindow.webContents.send('log_state', {msg: msgLog});
            }
        });
        uiService.stderr.on('data', (data) => {
            const msgData = data.toString();
            serverWindow.webContents.send('log_state', { msg: msgData });
            console.log('log error--', msgData);
        });
	} catch (error) {
		console.log('error upload', error);
	}
}

export async function runAsService(env, servicePath) {
    try {
        const options = {name: 'Gauzy Server'};
        const sudoer = new Sudoer(options);
        let cp = await sudoer.spawn(
            servicePath, {env: {...process.env, ...env}}
          );
        cp.on('close', () => {
            cp.output.stdout((buff) => {
                const data = buff.toString();
                console.log('message', data)
            })
            cp.output.stderr((buff) => {
                const data = buff.toString();
                console.log('message error', data)
            })
        });
    } catch (error) {
        console.log('error before', error);
    }
}