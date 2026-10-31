import { FormsModule } from '@angular/forms';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '@gauzy/ui-config';
import { GAUZY_ENV } from '../constants';
import { ElectronService } from '../electron/services';
import { LanguageSelectorComponent } from '../language/language-selector.component';
import { ToastrNotificationService } from '../services/toastr-notification.service';
import { SettingsComponent } from './settings.component';

/**
 * The "Server Hostname / IP Address" setting of Gauzy Server and Gauzy API Server (#7550): an invalid
 * host is never saved, by the Save button or by the settings that are stored at once (SSL, auto start).
 */
describe('SettingsComponent: server host', () => {
	let fixture: ComponentFixture<SettingsComponent>;
	let component: SettingsComponent;
	let send: jest.SpyInstance;
	let notifyError: jest.SpyInstance;

	async function create(isServer: boolean): Promise<void> {
		await TestBed.configureTestingModule({
			imports: [SettingsComponent],
			providers: [{ provide: GAUZY_ENV, useValue: { ...environment, IS_SERVER: isServer } }]
		})
			// See settings.component.spec.ts: the language selector needs FormsModule in the zone test env.
			.overrideComponent(LanguageSelectorComponent, { add: { imports: [FormsModule] } })
			.compileComponents();
		fixture = TestBed.createComponent(SettingsComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
		send = jest.spyOn(TestBed.inject(ElectronService).ipcRenderer, 'send');
		notifyError = jest
			.spyOn(TestBed.inject(ToastrNotificationService), 'error')
			.mockImplementation(() => undefined);
	}

	const sent = (channel: string) => send.mock.calls.filter(([name]) => name === channel).map(([, arg]) => arg);

	// The IPC bridge of test-setup.ts is one global object: spies on it would keep earlier tests' calls.
	afterEach(() => jest.restoreAllMocks());

	describe('Gauzy Server', () => {
		beforeEach(() => create(true));

		it.each(['999.1.1.1', 'bad host!'])('disables Save for the invalid host %s', (host) => {
			component.config.host = host;

			expect(component.isServerHostInvalid).toBe(true);
		});

		it.each([
			'0.0.0.0',
			'192.168.1.20',
			'gauzy.example.com',
			'localhost',
			'[fd00::20]',
			'http://192.168.1.20:3000',
			''
		])('keeps Save enabled for %s', (host) => {
			component.config.host = host;

			expect(component.isServerHostInvalid).toBe(false);
		});

		it('does not save an invalid host, and says why', async () => {
			component.config.host = '999.1.1.1';

			await component.restartApp();

			expect(sent('restart_app')).toEqual([]);
			expect(notifyError).toHaveBeenCalledWith('TIMER_TRACKER.SETTINGS.SERVER_HOST.INVALID');
		});

		it('saves a valid host without the spaces around it', async () => {
			component.config.host = ' 192.168.1.20 ';

			await component.restartApp();

			expect(sent('restart_app')).toEqual([expect.objectContaining({ host: '192.168.1.20' })]);
			expect(notifyError).not.toHaveBeenCalled();
		});

		it('keeps an invalid host out of a setting stored at once (auto start)', () => {
			component.config.host = 'bad host!';

			component.updateServerConfig(false, 'autoStart', false);

			const [stored] = sent('update_server_config');
			expect(stored).toEqual(expect.objectContaining({ autoStart: false }));
			expect(stored).not.toHaveProperty('host');
			// The field keeps what was typed, for the user to fix.
			expect(component.config.host).toBe('bad host!');
		});

		it('stores a valid host with a setting stored at once', () => {
			component.config.host = 'gauzy.example.com';

			component.updateServerConfig(false, 'autoStart', false);

			expect(sent('update_server_config')).toEqual([expect.objectContaining({ host: 'gauzy.example.com' })]);
		});

		it('stores the host without the spaces around it, as Save does, leaving the field as typed', () => {
			component.config.host = ' gauzy.example.com  ';

			component.updateServerConfig(false, 'autoStart', false);

			expect(sent('update_server_config')).toEqual([
				expect.objectContaining({ autoStart: false, host: 'gauzy.example.com' })
			]);
			expect(component.config.host).toBe(' gauzy.example.com  ');
		});
	});

	describe('apps without the host field', () => {
		beforeEach(() => create(false));

		it('do not check the host', () => {
			component.config.host = 'bad host!';

			expect(component.isServerHostInvalid).toBe(false);
		});
	});
});
