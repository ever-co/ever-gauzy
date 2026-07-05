import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import {
	IMakeComIntegrationSettings,
	IMakeComOrganization,
	IMakeComTeam,
	IMakeComScenario,
	IMakeComHook,
	IMakeComConnection,
	IMakeComTemplate,
	IMakeComSetupStatus,
	MakeComZone
} from '@gauzy/contracts';
import { MakeComService } from './make-com.service';

@Injectable({
	providedIn: 'root'
})
export class MakeComStoreService {
	// ─── Setup status state ──────────────────────────────────────────────────
	private readonly _setupStatus$ = new BehaviorSubject<IMakeComSetupStatus | null>(null);
	public setupStatus$ = this._setupStatus$.asObservable();

	// ─── Settings state ─────────────────────────────────────────────────────
	private readonly _settings$ = new BehaviorSubject<IMakeComIntegrationSettings | null>(null);
	public settings$ = this._settings$.asObservable();

	// ─── Zone state ─────────────────────────────────────────────────────────
	private readonly _zone$ = new BehaviorSubject<MakeComZone | null>(null);
	public zone$ = this._zone$.asObservable();

	// ─── Make.com context state ─────────────────────────────────────────────
	private readonly _makeOrganizations$ = new BehaviorSubject<IMakeComOrganization[]>([]);
	public makeOrganizations$ = this._makeOrganizations$.asObservable();

	private readonly _selectedMakeOrganization$ = new BehaviorSubject<IMakeComOrganization | null>(null);
	public selectedMakeOrganization$ = this._selectedMakeOrganization$.asObservable();

	private readonly _makeTeams$ = new BehaviorSubject<IMakeComTeam[]>([]);
	public makeTeams$ = this._makeTeams$.asObservable();

	private readonly _selectedMakeTeam$ = new BehaviorSubject<IMakeComTeam | null>(null);
	public selectedMakeTeam$ = this._selectedMakeTeam$.asObservable();

	// ─── Resource state ─────────────────────────────────────────────────────
	private readonly _scenarios$ = new BehaviorSubject<IMakeComScenario[]>([]);
	public scenarios$ = this._scenarios$.asObservable();

	private readonly _hooks$ = new BehaviorSubject<IMakeComHook[]>([]);
	public hooks$ = this._hooks$.asObservable();

	private readonly _connections$ = new BehaviorSubject<IMakeComConnection[]>([]);
	public connections$ = this._connections$.asObservable();

	private readonly _templates$ = new BehaviorSubject<IMakeComTemplate[]>([]);
	public templates$ = this._templates$.asObservable();

	constructor(private readonly _makeComService: MakeComService) {}

	// ─── Setup Status ───────────────────────────────────────────────────────

	loadSetupStatus(organizationId?: string): Observable<IMakeComSetupStatus> {
		return this._makeComService.getSetupStatus(organizationId).pipe(
			tap((status) => this._setupStatus$.next(status)),
			catchError((error) => {
				console.error('Error loading Make.com setup status:', error);
				return throwError(() => error);
			})
		);
	}

	getSetupStatus(): IMakeComSetupStatus | null {
		return this._setupStatus$.getValue();
	}

	// ─── Settings ───────────────────────────────────────────────────────────

	loadIntegrationSettings(): Observable<IMakeComIntegrationSettings> {
		return this._makeComService.getIntegrationSettings().pipe(
			tap((settings) => this._settings$.next(settings)),
			catchError((error) => {
				console.error('Error loading Make.com integration settings:', error);
				return throwError(() => error);
			})
		);
	}

	updateIntegrationSettings(settings: {
		isEnabled: boolean;
		webhookUrl: string;
	}): Observable<IMakeComIntegrationSettings> {
		return this._makeComService.updateIntegrationSettings(settings).pipe(
			tap((updatedSettings) => this._settings$.next(updatedSettings)),
			catchError((error) => {
				console.error('Error updating Make.com integration settings:', error);
				return throwError(() => error);
			})
		);
	}

	initializeIntegration(body: { organizationId: string }): Observable<{
		authorizationUrl: string;
		integrationId: string;
	}> {
		return this._makeComService.initializeIntegration(body).pipe(
			catchError((error) => {
				console.error('Error initializing Make.com integration:', error);
				return throwError(() => error);
			})
		);
	}

	getCurrentSettings(): IMakeComIntegrationSettings | null {
		return this._settings$.getValue();
	}

	// ─── Zone ───────────────────────────────────────────────────────────────

	loadZone(organizationId?: string): Observable<MakeComZone | null> {
		return this._makeComService.getZone(organizationId).pipe(
			tap((zone) => this._zone$.next(zone)),
			catchError((error) => {
				console.error('Error loading Make.com zone:', error);
				return throwError(() => error);
			})
		);
	}

	setZone(zone: MakeComZone, organizationId?: string): Observable<{ success: boolean; zone: MakeComZone }> {
		return this._makeComService.setZone(zone, organizationId).pipe(
			tap(() => {
				this._zone$.next(zone);
				this._setupStatus$.next(null);
				this._selectedMakeOrganization$.next(null);
				this._makeOrganizations$.next([]);
				this._selectedMakeTeam$.next(null);
				this._makeTeams$.next([]);
				this._scenarios$.next([]);
				this._hooks$.next([]);
				this._connections$.next([]);
				this._templates$.next([]);
			}),
			catchError((error) => {
				console.error('Error setting Make.com zone:', error);
				return throwError(() => error);
			})
		);
	}

	getZone(): MakeComZone | null {
		return this._zone$.getValue();
	}

	// ─── Organizations ──────────────────────────────────────────────────────

	loadMakeOrganizations(organizationId?: string): Observable<IMakeComOrganization[]> {
		return this._makeComService.listOrganizations(organizationId).pipe(
			tap((orgs) => this._makeOrganizations$.next(orgs)),
			catchError((error) => {
				console.error('Error loading Make.com organizations:', error);
				return throwError(() => error);
			})
		);
	}

	selectMakeOrganization(org: IMakeComOrganization, organizationId?: string): Observable<any> {
		return this._makeComService.setMakeOrganization(org.id, organizationId).pipe(
			tap(() => {
				this._selectedMakeOrganization$.next(org);
				this._selectedMakeTeam$.next(null);
				this._makeTeams$.next([]);
				this._scenarios$.next([]);
				this._hooks$.next([]);
				this._connections$.next([]);
				this._templates$.next([]);
			}),
			catchError((error) => {
				console.error('Error selecting Make.com organization:', error);
				return throwError(() => error);
			})
		);
	}

	// ─── Teams ──────────────────────────────────────────────────────────────

	loadMakeTeams(makeOrgId?: number, organizationId?: string): Observable<IMakeComTeam[]> {
		return this._makeComService.listTeams(makeOrgId, organizationId).pipe(
			tap((teams) => this._makeTeams$.next(teams)),
			catchError((error) => {
				console.error('Error loading Make.com teams:', error);
				return throwError(() => error);
			})
		);
	}

	selectMakeTeam(team: IMakeComTeam, organizationId?: string): Observable<any> {
		return this._makeComService.setMakeTeam(team.id, organizationId).pipe(
			tap(() => {
				this._selectedMakeTeam$.next(team);
				this._scenarios$.next([]);
				this._hooks$.next([]);
				this._connections$.next([]);
				this._templates$.next([]);
			}),
			catchError((error) => {
				console.error('Error selecting Make.com team:', error);
				return throwError(() => error);
			})
		);
	}

	// ─── Scenarios ──────────────────────────────────────────────────────────

	loadScenarios(teamId?: number, organizationId?: string): Observable<IMakeComScenario[]> {
		return this._makeComService.listScenarios(teamId, organizationId).pipe(
			tap((scenarios) => this._scenarios$.next(scenarios)),
			catchError((error) => {
				console.error('Error loading Make.com scenarios:', error);
				return throwError(() => error);
			})
		);
	}

	startScenario(id: number, organizationId?: string): Observable<IMakeComScenario> {
		return this._makeComService.startScenario(id, organizationId);
	}

	stopScenario(id: number, organizationId?: string): Observable<IMakeComScenario> {
		return this._makeComService.stopScenario(id, organizationId);
	}

	runScenario(id: number, organizationId?: string): Observable<any> {
		return this._makeComService.runScenario(id, organizationId);
	}

	deleteScenario(id: number, organizationId?: string): Observable<void> {
		return this._makeComService.deleteScenario(id, organizationId);
	}

	// ─── Hooks ──────────────────────────────────────────────────────────────

	loadHooks(teamId?: number, organizationId?: string): Observable<IMakeComHook[]> {
		return this._makeComService.listHooks(teamId, organizationId).pipe(
			tap((hooks) => this._hooks$.next(hooks)),
			catchError((error) => {
				console.error('Error loading Make.com hooks:', error);
				return throwError(() => error);
			})
		);
	}

	enableHook(id: number, organizationId?: string): Observable<any> {
		return this._makeComService.enableHook(id, organizationId);
	}

	disableHook(id: number, organizationId?: string): Observable<any> {
		return this._makeComService.disableHook(id, organizationId);
	}

	pingHook(id: number, organizationId?: string): Observable<any> {
		return this._makeComService.pingHook(id, organizationId);
	}

	deleteHook(id: number, organizationId?: string): Observable<void> {
		return this._makeComService.deleteHook(id, organizationId);
	}

	// ─── Connections ────────────────────────────────────────────────────────

	loadConnections(teamId?: number, organizationId?: string): Observable<IMakeComConnection[]> {
		return this._makeComService.listConnections(teamId, organizationId).pipe(
			tap((connections) => this._connections$.next(connections)),
			catchError((error) => {
				console.error('Error loading Make.com connections:', error);
				return throwError(() => error);
			})
		);
	}

	testConnection(id: number, organizationId?: string): Observable<any> {
		return this._makeComService.testConnection(id, organizationId);
	}

	deleteConnection(id: number, organizationId?: string): Observable<void> {
		return this._makeComService.deleteConnection(id, organizationId);
	}

	// ─── Templates ──────────────────────────────────────────────────────────

	loadTemplates(teamId?: number, organizationId?: string): Observable<IMakeComTemplate[]> {
		return this._makeComService.listTemplates(teamId, organizationId).pipe(
			tap((templates) => this._templates$.next(templates)),
			catchError((error) => {
				console.error('Error loading Make.com templates:', error);
				return throwError(() => error);
			})
		);
	}

	// ─── Store Management ───────────────────────────────────────────────────

	clearStore(): void {
		this._setupStatus$.next(null);
		this._settings$.next(null);
		this._zone$.next(null);
		this._makeOrganizations$.next([]);
		this._selectedMakeOrganization$.next(null);
		this._makeTeams$.next([]);
		this._selectedMakeTeam$.next(null);
		this._scenarios$.next([]);
		this._hooks$.next([]);
		this._connections$.next([]);
		this._templates$.next([]);
	}
}
