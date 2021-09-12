import os from 'os';

const createServer = () => {
	const platform = os.platform();
	let Service:any | null = null;
	let svc:any | null = null;
	switch (platform) {
		case 'win32':
			Service = require('node-windows').Service;
			break;
		case 'darwin':
			Service = require('node-mac').Service;
			break;
		default:
			break;
	}

	svc = new Service({
		name: 'gauzyservice',
		description: 'Gauzy Server As Service',
		script: './service.js'
	});
	if (svc.exists) {
		svc.on('uninstall',function(){
			console.log('Uninstall complete.');
			console.log('The service exists: ',svc.exists);
		  });
		svc.uninstall();
	} else {
		svc.on('install',function(){
			console.log('on install');
			svc.on('start', () => {
				console.log('service start');
			})
			svc.start();
		});
		svc.on('error', () => {
			console.log('service install error');
		});
		svc.on('invalidinstallation ', () => {
			console.log('service invalid installation');
		})
		svc.install(os.tmpdir);
	}
}

createServer();