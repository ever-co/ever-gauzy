import { fork } from 'child_process';
import path from 'path';

function apiServer() {
    const servicePath = {
        api: path.join(__dirname, 'main.js'),
        ui: process.env.gauzyuipath
    }
	try {
		const uiService = fork(servicePath.api, { silent: true, env: process.env });

        uiService.stdout.on('data', (data) => {
            const msgData = data.toString()
            console.log('log state --> ', msgData);
            if (msgData.indexOf('Listening at http') > -1) {
                UiServerTask(servicePath.ui);
            }
            // uiService.unref();
            // process.exit(0);
        });

        uiService.stderr.on('data', (data) => {
			const msgData = data.toString();
			console.log('log error--', msgData);
		});


	} catch (error) {
        console.log('log state', error);
	}
  }

function UiServerTask(uiPath) {
	try {
        const uiService = fork(uiPath, { silent: true, env: process.env});
        uiService.stdout.on('data', (data) => {
            const msgLog = data.toString();
            console.log('SERVER UI STATE LOGS -> ', msgLog);
            
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

apiServer();