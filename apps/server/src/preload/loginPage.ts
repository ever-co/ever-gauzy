import { ipcRenderer } from 'electron';

ipcRenderer.on('hide_register', () => {
	const waitElement = setInterval(() => {
		try {
			document
				.querySelector('[aria-label="Register"]')
				.setAttribute('style', 'display: none');
			clearInterval(waitElement);
		} catch (error) {}
	});
});
