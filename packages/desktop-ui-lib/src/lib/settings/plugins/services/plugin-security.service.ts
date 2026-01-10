import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IPagination } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';
import { BehaviorSubject, Observable, shareReplay, tap } from 'rxjs';

// Security interfaces
export interface IPluginSecurity {
	id: string;
	pluginId: string;
	tenantId?: string;
	organizationId?: string;
	securityLevel: SecurityLevel;
	permissions: IPluginPermission[];
	apiKeys: IPluginApiKey[];
	certificates: IPluginCertificate[];
	securityConfig: ISecurityConfig;
	threats: IThreatDetection[];
	audits: ISecurityAudit[];
	compliance: IComplianceStatus;
	lastSecurityScan: Date;
	lastUpdated: Date;
	isActive: boolean;
}

export interface IPluginPermission {
	id: string;
	pluginId: string;
	resource: string;
	action: PermissionAction;
	scope: PermissionScope;
	conditions?: IPermissionCondition[];
	grantedBy: string;
	grantedAt: Date;
	expiresAt?: Date;
	isActive: boolean;
	metadata?: Record<string, any>;
}

export interface IPermissionCondition {
	field: string;
	operator: string;
	value: any;
	type: 'user' | 'time' | 'location' | 'device' | 'custom';
}

export interface IPluginApiKey {
	id: string;
	pluginId: string;
	name: string;
	keyHash: string;
	keyPrefix: string;
	scopes: string[];
	rateLimit: IRateLimit;
	allowedIps?: string[];
	allowedDomains?: string[];
	lastUsed?: Date;
	usageCount: number;
	isActive: boolean;
	expiresAt?: Date;
	createdAt: Date;
	createdBy: string;
	metadata?: Record<string, any>;
}

export interface IRateLimit {
	requestsPerMinute: number;
	requestsPerHour: number;
	requestsPerDay: number;
	burstLimit: number;
}

export interface IPluginCertificate {
	id: string;
	pluginId: string;
	name: string;
	type: CertificateType;
	issuer: string;
	subject: string;
	serialNumber: string;
	fingerprint: string;
	validFrom: Date;
	validTo: Date;
	keySize: number;
	algorithm: string;
	purposes: string[];
	isValid: boolean;
	isRevoked: boolean;
	chainVerified: boolean;
	createdAt: Date;
	lastVerified: Date;
}

export interface ISecurityConfig {
	encryption: IEncryptionConfig;
	authentication: IAuthenticationConfig;
	authorization: IAuthorizationConfig;
	networking: INetworkingConfig;
	logging: ILoggingConfig;
	monitoring: IMonitoringConfig;
}

export interface IEncryptionConfig {
	dataAtRest: boolean;
	dataInTransit: boolean;
	keyRotationDays: number;
	algorithm: string;
	keySize: number;
	saltRounds: number;
}

export interface IAuthenticationConfig {
	multiFactorRequired: boolean;
	sessionTimeout: number;
	maxLoginAttempts: number;
	lockoutDuration: number;
	passwordPolicy: IPasswordPolicy;
	ssoEnabled: boolean;
	allowedProviders: string[];
}

export interface IPasswordPolicy {
	minLength: number;
	requireUppercase: boolean;
	requireLowercase: boolean;
	requireNumbers: boolean;
	requireSymbols: boolean;
	preventReuse: number;
	expirationDays: number;
}

export interface IAuthorizationConfig {
	rbacEnabled: boolean;
	defaultRole: string;
	inheritanceEnabled: boolean;
	conditionalAccess: boolean;
	privilegedAccessReview: boolean;
}

export interface INetworkingConfig {
	allowedIps: string[];
	blockedIps: string[];
	allowedDomains: string[];
	blockedDomains: string[];
	corsEnabled: boolean;
	corsOrigins: string[];
	rateLimiting: IRateLimit;
}

export interface ILoggingConfig {
	auditEnabled: boolean;
	logLevel: LogLevel;
	retentionDays: number;
	piiRedaction: boolean;
	realTimeMonitoring: boolean;
}

export interface IMonitoringConfig {
	threatDetection: boolean;
	anomalyDetection: boolean;
	intrusionDetection: boolean;
	complianceMonitoring: boolean;
	alertThresholds: IAlertThresholds;
}

export interface IAlertThresholds {
	failedLoginAttempts: number;
	unusualActivity: number;
	dataAccess: number;
	privilegeEscalation: number;
}

export interface IThreatDetection {
	id: string;
	pluginId: string;
	threatType: ThreatType;
	severity: ThreatSeverity;
	description: string;
	source: string;
	targetResource: string;
	detectedAt: Date;
	isResolved: boolean;
	resolvedAt?: Date;
	resolvedBy?: string;
	actionsTaken: string[];
	evidence: IThreatEvidence[];
	riskScore: number;
	metadata?: Record<string, any>;
}

export interface IThreatEvidence {
	type: string;
	data: any;
	timestamp: Date;
	source: string;
}

export interface ISecurityAudit {
	id: string;
	pluginId: string;
	userId: string;
	action: AuditAction;
	resource: string;
	details: Record<string, any>;
	ipAddress: string;
	userAgent: string;
	timestamp: Date;
	result: AuditResult;
	riskLevel: RiskLevel;
	sessionId?: string;
	metadata?: Record<string, any>;
}

export interface IComplianceStatus {
	frameworks: IComplianceFramework[];
	overallScore: number;
	lastAssessment: Date;
	nextAssessment: Date;
	violations: IComplianceViolation[];
	recommendations: IComplianceRecommendation[];
}

export interface IComplianceFramework {
	name: string;
	version: string;
	score: number;
	status: ComplianceStatus;
	requirements: IComplianceRequirement[];
	lastChecked: Date;
}

export interface IComplianceRequirement {
	id: string;
	name: string;
	description: string;
	status: ComplianceStatus;
	evidence?: string[];
	lastChecked: Date;
}

export interface IComplianceViolation {
	id: string;
	requirement: string;
	description: string;
	severity: ViolationSeverity;
	detectedAt: Date;
	resolvedAt?: Date;
	resolution?: string;
}

export interface IComplianceRecommendation {
	id: string;
	title: string;
	description: string;
	priority: RecommendationPriority;
	category: string;
	effort: string;
	impact: string;
	resources: string[];
}

export interface ISecurityScan {
	id: string;
	pluginId: string;
	scanType: ScanType;
	status: ScanStatus;
	startedAt: Date;
	completedAt?: Date;
	duration?: number;
	results: IScanResult;
	scheduledBy: string;
	configuration: IScanConfiguration;
}

export interface IScanResult {
	overallScore: number;
	vulnerabilities: IVulnerability[];
	issues: ISecurityIssue[];
	recommendations: string[];
	summary: IScanSummary;
}

export interface IVulnerability {
	id: string;
	cveId?: string;
	title: string;
	description: string;
	severity: VulnerabilitySeverity;
	cvssScore: number;
	vector: string;
	affected: string[];
	patched: boolean;
	patchVersion?: string;
	discoveredAt: Date;
	references: string[];
}

export interface ISecurityIssue {
	id: string;
	category: string;
	title: string;
	description: string;
	severity: IssueSeverity;
	location: string;
	line?: number;
	recommendation: string;
	cweId?: string;
}

export interface IScanSummary {
	total: number;
	critical: number;
	high: number;
	medium: number;
	low: number;
	info: number;
	fixed: number;
}

export interface IScanConfiguration {
	depth: ScanDepth;
	includeTests: boolean;
	includeDependencies: boolean;
	customRules: string[];
	excludePaths: string[];
	timeout: number;
}

// Enums
export enum SecurityLevel {
	LOW = 'low',
	MEDIUM = 'medium',
	HIGH = 'high',
	CRITICAL = 'critical'
}

export enum PermissionAction {
	READ = 'read',
	WRITE = 'write',
	DELETE = 'delete',
	EXECUTE = 'execute',
	ADMIN = 'admin',
	ALL = 'all'
}

export enum PermissionScope {
	GLOBAL = 'global',
	TENANT = 'tenant',
	ORGANIZATION = 'organization',
	USER = 'user',
	RESOURCE = 'resource'
}

export enum CertificateType {
	SSL_TLS = 'ssl_tls',
	CODE_SIGNING = 'code_signing',
	CLIENT_AUTH = 'client_auth',
	EMAIL = 'email',
	ROOT_CA = 'root_ca',
	INTERMEDIATE_CA = 'intermediate_ca'
}

export enum ThreatType {
	MALWARE = 'malware',
	PHISHING = 'phishing',
	INJECTION = 'injection',
	XSS = 'xss',
	CSRF = 'csrf',
	UNAUTHORIZED_ACCESS = 'unauthorized_access',
	PRIVILEGE_ESCALATION = 'privilege_escalation',
	DATA_BREACH = 'data_breach',
	DDOS = 'ddos',
	BRUTE_FORCE = 'brute_force',
	INSIDER_THREAT = 'insider_threat',
	SUPPLY_CHAIN = 'supply_chain'
}

export enum ThreatSeverity {
	LOW = 'low',
	MEDIUM = 'medium',
	HIGH = 'high',
	CRITICAL = 'critical'
}

export enum AuditAction {
	LOGIN = 'login',
	LOGOUT = 'logout',
	ACCESS = 'access',
	CREATE = 'create',
	READ = 'read',
	UPDATE = 'update',
	DELETE = 'delete',
	DOWNLOAD = 'download',
	UPLOAD = 'upload',
	CONFIGURE = 'configure',
	INSTALL = 'install',
	UNINSTALL = 'uninstall',
	ACTIVATE = 'activate',
	DEACTIVATE = 'deactivate'
}

export enum AuditResult {
	SUCCESS = 'success',
	FAILURE = 'failure',
	BLOCKED = 'blocked',
	WARNING = 'warning'
}

export enum RiskLevel {
	VERY_LOW = 'very_low',
	LOW = 'low',
	MEDIUM = 'medium',
	HIGH = 'high',
	VERY_HIGH = 'very_high'
}

export enum ComplianceStatus {
	COMPLIANT = 'compliant',
	NON_COMPLIANT = 'non_compliant',
	PARTIALLY_COMPLIANT = 'partially_compliant',
	NOT_ASSESSED = 'not_assessed',
	EXEMPT = 'exempt'
}

export enum ViolationSeverity {
	LOW = 'low',
	MEDIUM = 'medium',
	HIGH = 'high',
	CRITICAL = 'critical'
}

export enum RecommendationPriority {
	LOW = 'low',
	MEDIUM = 'medium',
	HIGH = 'high',
	URGENT = 'urgent'
}

export enum ScanType {
	STATIC_ANALYSIS = 'static_analysis',
	DYNAMIC_ANALYSIS = 'dynamic_analysis',
	DEPENDENCY_CHECK = 'dependency_check',
	CONFIGURATION_AUDIT = 'configuration_audit',
	COMPLIANCE_CHECK = 'compliance_check',
	PENETRATION_TEST = 'penetration_test',
	FULL_SCAN = 'full_scan'
}

export enum ScanStatus {
	PENDING = 'pending',
	RUNNING = 'running',
	COMPLETED = 'completed',
	FAILED = 'failed',
	CANCELLED = 'cancelled'
}

export enum VulnerabilitySeverity {
	NONE = 'none',
	LOW = 'low',
	MEDIUM = 'medium',
	HIGH = 'high',
	CRITICAL = 'critical'
}

export enum IssueSeverity {
	INFO = 'info',
	LOW = 'low',
	MEDIUM = 'medium',
	HIGH = 'high',
	CRITICAL = 'critical'
}

export enum ScanDepth {
	SHALLOW = 'shallow',
	MEDIUM = 'medium',
	DEEP = 'deep',
	COMPREHENSIVE = 'comprehensive'
}

export enum LogLevel {
	DEBUG = 'debug',
	INFO = 'info',
	WARN = 'warn',
	ERROR = 'error',
	FATAL = 'fatal'
}

@Injectable({
	providedIn: 'root'
})
export class PluginSecurityService {
	private readonly endPoint = `${API_PREFIX}/plugin-security`;
	private readonly permissionsEndPoint = `${API_PREFIX}/plugin-permissions`;
	private readonly auditEndPoint = `${API_PREFIX}/plugin-audit`;
	private readonly scansEndPoint = `${API_PREFIX}/plugin-scans`;

	private readonly securityCache$ = new BehaviorSubject<Map<string, IPluginSecurity>>(new Map());
	private readonly threatsCache$ = new BehaviorSubject<Map<string, IThreatDetection[]>>(new Map());

	constructor(private readonly http: HttpClient) {}

	// Plugin Security Management
	public getPluginSecurity(pluginId: string): Observable<IPluginSecurity> {
		return this.http.get<IPluginSecurity>(`${this.endPoint}/plugins/${pluginId}`).pipe(
			tap((security) => {
				const cache = this.securityCache$.value;
				cache.set(pluginId, security);
				this.securityCache$.next(cache);
			}),
			shareReplay(1)
		);
	}

	public updatePluginSecurity(pluginId: string, security: Partial<IPluginSecurity>): Observable<IPluginSecurity> {
		return this.http.put<IPluginSecurity>(`${this.endPoint}/plugins/${pluginId}`, security).pipe(
			tap((updatedSecurity) => {
				const cache = this.securityCache$.value;
				cache.set(pluginId, updatedSecurity);
				this.securityCache$.next(cache);
			})
		);
	}

	public initializePluginSecurity(pluginId: string, level: SecurityLevel): Observable<IPluginSecurity> {
		return this.http
			.post<IPluginSecurity>(`${this.endPoint}/plugins/${pluginId}/initialize`, {
				securityLevel: level
			})
			.pipe(
				tap((security) => {
					const cache = this.securityCache$.value;
					cache.set(pluginId, security);
					this.securityCache$.next(cache);
				})
			);
	}

	// Permission Management
	public getPluginPermissions(pluginId: string): Observable<IPluginPermission[]> {
		return this.http
			.get<IPluginPermission[]>(`${this.permissionsEndPoint}/plugins/${pluginId}`)
			.pipe(shareReplay(1));
	}

	public createPermission(permission: Omit<IPluginPermission, 'id' | 'grantedAt'>): Observable<IPluginPermission> {
		return this.http.post<IPluginPermission>(this.permissionsEndPoint, {
			...permission,
			grantedAt: new Date()
		});
	}

	public updatePermission(id: string, permission: Partial<IPluginPermission>): Observable<IPluginPermission> {
		return this.http.put<IPluginPermission>(`${this.permissionsEndPoint}/${id}`, permission);
	}

	public revokePermission(id: string): Observable<void> {
		return this.http.delete<void>(`${this.permissionsEndPoint}/${id}`);
	}

	public checkPermission(
		pluginId: string,
		resource: string,
		action: PermissionAction,
		userId?: string
	): Observable<{
		allowed: boolean;
		reason?: string;
		conditions?: IPermissionCondition[];
	}> {
		const params: any = { resource, action };
		if (userId) params.userId = userId;

		return this.http.get<{
			allowed: boolean;
			reason?: string;
			conditions?: IPermissionCondition[];
		}>(`${this.permissionsEndPoint}/plugins/${pluginId}/check`, {
			params: toParams(params)
		});
	}

	public bulkUpdatePermissions(
		pluginId: string,
		permissions: Array<{
			resource: string;
			action: PermissionAction;
			scope: PermissionScope;
			isActive: boolean;
		}>
	): Observable<IPluginPermission[]> {
		return this.http.put<IPluginPermission[]>(`${this.permissionsEndPoint}/plugins/${pluginId}/bulk`, {
			permissions
		});
	}

	// API Key Management
	public getApiKeys(pluginId: string): Observable<IPluginApiKey[]> {
		return this.http.get<IPluginApiKey[]>(`${this.endPoint}/plugins/${pluginId}/api-keys`).pipe(shareReplay(1));
	}

	public createApiKey(
		apiKey: Omit<IPluginApiKey, 'id' | 'keyHash' | 'keyPrefix' | 'createdAt' | 'usageCount' | 'lastUsed'>
	): Observable<{
		apiKey: IPluginApiKey;
		key: string;
	}> {
		return this.http.post<{
			apiKey: IPluginApiKey;
			key: string;
		}>(`${this.endPoint}/plugins/${apiKey.pluginId}/api-keys`, apiKey);
	}

	public updateApiKey(id: string, apiKey: Partial<IPluginApiKey>): Observable<IPluginApiKey> {
		return this.http.put<IPluginApiKey>(`${this.endPoint}/api-keys/${id}`, apiKey);
	}

	public revokeApiKey(id: string): Observable<void> {
		return this.http.delete<void>(`${this.endPoint}/api-keys/${id}`);
	}

	public regenerateApiKey(id: string): Observable<{
		apiKey: IPluginApiKey;
		key: string;
	}> {
		return this.http.post<{
			apiKey: IPluginApiKey;
			key: string;
		}>(`${this.endPoint}/api-keys/${id}/regenerate`, {});
	}

	public getApiKeyUsage(
		id: string,
		days: number = 30
	): Observable<{
		usage: Array<{
			date: Date;
			requests: number;
			errors: number;
		}>;
		total: number;
		rateLimit: IRateLimit;
		remaining: number;
	}> {
		const params = { days };
		return this.http.get<{
			usage: Array<{
				date: Date;
				requests: number;
				errors: number;
			}>;
			total: number;
			rateLimit: IRateLimit;
			remaining: number;
		}>(`${this.endPoint}/api-keys/${id}/usage`, {
			params: toParams(params)
		});
	}

	// Certificate Management
	public getCertificates(pluginId: string): Observable<IPluginCertificate[]> {
		return this.http
			.get<IPluginCertificate[]>(`${this.endPoint}/plugins/${pluginId}/certificates`)
			.pipe(shareReplay(1));
	}

	public uploadCertificate(
		pluginId: string,
		certificate: File,
		name: string,
		type: CertificateType
	): Observable<IPluginCertificate> {
		const formData = new FormData();
		formData.append('certificate', certificate);
		formData.append('name', name);
		formData.append('type', type);

		return this.http.post<IPluginCertificate>(`${this.endPoint}/plugins/${pluginId}/certificates`, formData);
	}

	public verifyCertificate(id: string): Observable<{
		isValid: boolean;
		issues: string[];
		details: any;
	}> {
		return this.http.post<{
			isValid: boolean;
			issues: string[];
			details: any;
		}>(`${this.endPoint}/certificates/${id}/verify`, {});
	}

	public deleteCertificate(id: string): Observable<void> {
		return this.http.delete<void>(`${this.endPoint}/certificates/${id}`);
	}

	public getCertificateChain(id: string): Observable<IPluginCertificate[]> {
		return this.http.get<IPluginCertificate[]>(`${this.endPoint}/certificates/${id}/chain`);
	}

	// Threat Detection and Monitoring
	public getThreats(pluginId: string): Observable<IThreatDetection[]> {
		return this.http.get<IThreatDetection[]>(`${this.endPoint}/plugins/${pluginId}/threats`).pipe(
			tap((threats) => {
				const cache = this.threatsCache$.value;
				cache.set(pluginId, threats);
				this.threatsCache$.next(cache);
			}),
			shareReplay(1)
		);
	}

	public markThreatResolved(id: string, resolution: string, actionsTaken: string[]): Observable<IThreatDetection> {
		return this.http
			.put<IThreatDetection>(`${this.endPoint}/threats/${id}/resolve`, {
				resolution,
				actionsTaken,
				resolvedAt: new Date()
			})
			.pipe(
				tap((threat) => {
					const cache = this.threatsCache$.value;
					const pluginThreats = cache.get(threat.pluginId) || [];
					const updatedThreats = pluginThreats.map((t) => (t.id === id ? threat : t));
					cache.set(threat.pluginId, updatedThreats);
					this.threatsCache$.next(cache);
				})
			);
	}

	public getThreatTrends(
		pluginId?: string,
		days: number = 30
	): Observable<{
		trends: Array<{
			date: Date;
			threats: number;
			resolved: number;
			types: Record<ThreatType, number>;
		}>;
		summary: {
			total: number;
			resolved: number;
			critical: number;
			topTypes: Array<{ type: ThreatType; count: number }>;
		};
	}> {
		const params: any = { days };
		if (pluginId) params.pluginId = pluginId;

		return this.http.get<{
			trends: Array<{
				date: Date;
				threats: number;
				resolved: number;
				types: Record<ThreatType, number>;
			}>;
			summary: {
				total: number;
				resolved: number;
				critical: number;
				topTypes: Array<{ type: ThreatType; count: number }>;
			};
		}>(`${this.endPoint}/threats/trends`, {
			params: toParams(params)
		});
	}

	// Security Auditing
	public getAuditLogs<T>(params = {} as T): Observable<IPagination<ISecurityAudit>> {
		return this.http
			.get<IPagination<ISecurityAudit>>(this.auditEndPoint, {
				params: toParams(params)
			})
			.pipe(shareReplay(1));
	}

	public getPluginAuditLogs(
		pluginId: string,
		startDate?: Date,
		endDate?: Date,
		actions?: AuditAction[]
	): Observable<ISecurityAudit[]> {
		const params: any = {};
		if (startDate) params.startDate = startDate.toISOString();
		if (endDate) params.endDate = endDate.toISOString();
		if (actions?.length) params.actions = actions.join(',');

		return this.http
			.get<ISecurityAudit[]>(`${this.auditEndPoint}/plugins/${pluginId}`, {
				params: toParams(params)
			})
			.pipe(shareReplay(1));
	}

	public createAuditLog(audit: Omit<ISecurityAudit, 'id' | 'timestamp'>): Observable<ISecurityAudit> {
		return this.http.post<ISecurityAudit>(this.auditEndPoint, {
			...audit,
			timestamp: new Date()
		});
	}

	public getAuditStatistics(
		pluginId?: string,
		days: number = 30
	): Observable<{
		totalEvents: number;
		successRate: number;
		topActions: Array<{ action: AuditAction; count: number }>;
		riskDistribution: Record<RiskLevel, number>;
		trends: Array<{
			date: Date;
			events: number;
			failures: number;
			highRisk: number;
		}>;
	}> {
		const params: any = { days };
		if (pluginId) params.pluginId = pluginId;

		return this.http.get<{
			totalEvents: number;
			successRate: number;
			topActions: Array<{ action: AuditAction; count: number }>;
			riskDistribution: Record<RiskLevel, number>;
			trends: Array<{
				date: Date;
				events: number;
				failures: number;
				highRisk: number;
			}>;
		}>(`${this.auditEndPoint}/statistics`, {
			params: toParams(params)
		});
	}

	// Security Scanning
	public initiateScan(
		pluginId: string,
		scanType: ScanType,
		configuration?: Partial<IScanConfiguration>
	): Observable<ISecurityScan> {
		return this.http.post<ISecurityScan>(`${this.scansEndPoint}/plugins/${pluginId}/scan`, {
			scanType,
			configuration: {
				depth: ScanDepth.MEDIUM,
				includeTests: true,
				includeDependencies: true,
				customRules: [],
				excludePaths: [],
				timeout: 300000, // 5 minutes
				...configuration
			}
		});
	}

	public getScanResults(scanId: string): Observable<ISecurityScan> {
		return this.http.get<ISecurityScan>(`${this.scansEndPoint}/${scanId}`);
	}

	public getPluginScans(pluginId: string): Observable<ISecurityScan[]> {
		return this.http.get<ISecurityScan[]>(`${this.scansEndPoint}/plugins/${pluginId}`).pipe(shareReplay(1));
	}

	public cancelScan(scanId: string): Observable<ISecurityScan> {
		return this.http.post<ISecurityScan>(`${this.scansEndPoint}/${scanId}/cancel`, {});
	}

	public scheduleScan(
		pluginId: string,
		scanType: ScanType,
		schedule: {
			frequency: 'daily' | 'weekly' | 'monthly';
			time: string;
			timezone: string;
		},
		configuration?: Partial<IScanConfiguration>
	): Observable<{
		id: string;
		nextRun: Date;
	}> {
		return this.http.post<{
			id: string;
			nextRun: Date;
		}>(`${this.scansEndPoint}/plugins/${pluginId}/schedule`, {
			scanType,
			schedule,
			configuration
		});
	}

	// Compliance Management
	public getComplianceStatus(pluginId: string): Observable<IComplianceStatus> {
		return this.http.get<IComplianceStatus>(`${this.endPoint}/plugins/${pluginId}/compliance`).pipe(shareReplay(1));
	}

	public runComplianceCheck(pluginId: string, frameworks: string[]): Observable<IComplianceStatus> {
		return this.http.post<IComplianceStatus>(`${this.endPoint}/plugins/${pluginId}/compliance/check`, {
			frameworks
		});
	}

	public markViolationResolved(violationId: string, resolution: string): Observable<IComplianceViolation> {
		return this.http.put<IComplianceViolation>(`${this.endPoint}/violations/${violationId}/resolve`, {
			resolution,
			resolvedAt: new Date()
		});
	}

	public getComplianceReport(
		pluginId: string,
		framework: string,
		format: 'json' | 'pdf' | 'csv' = 'json'
	): Observable<Blob | any> {
		const params = { framework, format };
		const responseType = format === 'json' ? 'json' : 'blob';

		return this.http.get(`${this.endPoint}/plugins/${pluginId}/compliance/report`, {
			params: toParams(params),
			responseType: responseType as any
		});
	}

	// Utility Methods
	public getSecurityScore(pluginId: string): Observable<{
		overallScore: number;
		breakdown: {
			permissions: number;
			encryption: number;
			authentication: number;
			monitoring: number;
			compliance: number;
		};
		recommendations: string[];
	}> {
		return this.http.get<{
			overallScore: number;
			breakdown: {
				permissions: number;
				encryption: number;
				authentication: number;
				monitoring: number;
				compliance: number;
			};
			recommendations: string[];
		}>(`${this.endPoint}/plugins/${pluginId}/score`);
	}

	public generateSecurityReport(
		pluginId: string,
		sections: string[] = ['overview', 'threats', 'vulnerabilities', 'compliance', 'recommendations']
	): Observable<Blob> {
		const params = { sections: sections.join(',') };

		return this.http.get(`${this.endPoint}/plugins/${pluginId}/report`, {
			params: toParams(params),
			responseType: 'blob'
		});
	}

	public getSecurityBenchmarks(category?: string): Observable<{
		benchmarks: Array<{
			name: string;
			category: string;
			description: string;
			averageScore: number;
			industryStandard: number;
		}>;
		pluginComparison?: {
			pluginId: string;
			scores: Record<string, number>;
			ranking: number;
		};
	}> {
		const params = category ? { category } : {};

		return this.http.get<{
			benchmarks: Array<{
				name: string;
				category: string;
				description: string;
				averageScore: number;
				industryStandard: number;
			}>;
			pluginComparison?: {
				pluginId: string;
				scores: Record<string, number>;
				ranking: number;
			};
		}>(`${this.endPoint}/benchmarks`, {
			params: toParams(params)
		});
	}

	public validateSecurityConfiguration(config: Partial<ISecurityConfig>): Observable<{
		valid: boolean;
		issues: Array<{
			field: string;
			message: string;
			severity: 'warning' | 'error';
		}>;
		recommendations: string[];
	}> {
		return this.http.post<{
			valid: boolean;
			issues: Array<{
				field: string;
				message: string;
				severity: 'warning' | 'error';
			}>;
			recommendations: string[];
		}>(`${this.endPoint}/validate-config`, config);
	}

	public getSecurityAlerts(pluginId?: string): Observable<
		Array<{
			id: string;
			pluginId: string;
			type: string;
			severity: ThreatSeverity;
			message: string;
			timestamp: Date;
			isRead: boolean;
		}>
	> {
		const params = pluginId ? { pluginId } : {};

		return this.http
			.get<
				Array<{
					id: string;
					pluginId: string;
					type: string;
					severity: ThreatSeverity;
					message: string;
					timestamp: Date;
					isRead: boolean;
				}>
			>(`${this.endPoint}/alerts`, {
				params: toParams(params)
			})
			.pipe(shareReplay(1));
	}

	public markAlertRead(alertId: string): Observable<void> {
		return this.http.put<void>(`${this.endPoint}/alerts/${alertId}/read`, {});
	}

	public dismissAlert(alertId: string): Observable<void> {
		return this.http.delete<void>(`${this.endPoint}/alerts/${alertId}`);
	}

	// Helper Methods
	public getSeverityColor(severity: ThreatSeverity | VulnerabilitySeverity | IssueSeverity): string {
		const colorMap = {
			low: 'success',
			medium: 'warning',
			high: 'danger',
			critical: 'danger',
			info: 'info',
			none: 'basic'
		};

		return colorMap[severity.toLowerCase() as keyof typeof colorMap] || 'basic';
	}

	public getSeverityIcon(severity: ThreatSeverity | VulnerabilitySeverity | IssueSeverity): string {
		const iconMap = {
			low: 'info-outline',
			medium: 'alert-triangle-outline',
			high: 'alert-circle-outline',
			critical: 'flash-outline',
			info: 'info-outline',
			none: 'checkmark-circle-outline'
		};

		return iconMap[severity.toLowerCase() as keyof typeof iconMap] || 'help-circle-outline';
	}

	public formatRiskScore(score: number): {
		level: RiskLevel;
		color: string;
		label: string;
	} {
		if (score >= 80) {
			return { level: RiskLevel.VERY_HIGH, color: 'danger', label: 'Very High Risk' };
		} else if (score >= 60) {
			return { level: RiskLevel.HIGH, color: 'danger', label: 'High Risk' };
		} else if (score >= 40) {
			return { level: RiskLevel.MEDIUM, color: 'warning', label: 'Medium Risk' };
		} else if (score >= 20) {
			return { level: RiskLevel.LOW, color: 'info', label: 'Low Risk' };
		} else {
			return { level: RiskLevel.VERY_LOW, color: 'success', label: 'Very Low Risk' };
		}
	}

	public getComplianceStatusColor(status: ComplianceStatus): string {
		const colorMap = {
			compliant: 'success',
			non_compliant: 'danger',
			partially_compliant: 'warning',
			not_assessed: 'basic',
			exempt: 'info'
		};

		return colorMap[status] || 'basic';
	}

	public getActionIcon(action: AuditAction): string {
		const iconMap = {
			login: 'log-in-outline',
			logout: 'log-out-outline',
			access: 'eye-outline',
			create: 'plus-outline',
			read: 'file-text-outline',
			update: 'edit-outline',
			delete: 'trash-outline',
			download: 'download-outline',
			upload: 'upload-outline',
			configure: 'settings-outline',
			install: 'download-outline',
			uninstall: 'trash-2-outline',
			activate: 'checkmark-outline',
			deactivate: 'close-outline'
		};

		return iconMap[action] || 'activity-outline';
	}
}
