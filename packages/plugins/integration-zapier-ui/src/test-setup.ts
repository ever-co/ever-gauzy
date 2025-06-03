import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';
import 'jest-preset-angular/setup-jest';

setupZoneTestEnv({
	errorOnUnknownElements: true,
	errorOnUnknownProperties: true
});

/* global mocks for jsdom */
const mock = () => {
	let storage: { [key: string]: string } = {};
	return {
		getItem: (key: string) => (key in storage ? storage[key] : null),
		setItem: (key: string, value: string) => (storage[key] = value || ''),
		removeItem: (key: string) => delete storage[key],
		clear: () => (storage = {})
	};
};

Object.defineProperty(window, 'localStorage', { value: mock() });
Object.defineProperty(window, 'sessionStorage', { value: mock() });
Object.defineProperty(window, 'getComputedStyle', {
	value: () => ['-webkit-appearance']
});

Object.defineProperty(document.body, 'clientWidth', { value: 1024 });
Object.defineProperty(document.body, 'clientHeight', { value: 768 });
