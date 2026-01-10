import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IPagination } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';
import { BehaviorSubject, combineLatest, map, Observable, shareReplay } from 'rxjs';

// Analytics interfaces
export interface IPluginAnalytics {
	id: string;
	pluginId: string;
	tenantId?: string;
	organizationId?: string;
	userId?: string;
	eventType: PluginEventType;
	eventData: Record<string, any>;
	timestamp: Date;
	sessionId?: string;
	userAgent?: string;
	ipAddress?: string;
	metadata?: Record<string, any>;
}

export interface IPluginMetrics {
	pluginId: string;
	totalInstalls: number;
	activeInstalls: number;
	totalUninstalls: number;
	avgRating: number;
	totalReviews: number;
	totalDownloads: number;
	uniqueUsers: number;
	totalRevenue: number;
	conversionRate: number;
	retentionRate: number;
	churnRate: number;
	period: AnalyticsPeriod;
	lastUpdated: Date;
	breakdown: IMetricsBreakdown;
}

export interface IMetricsBreakdown {
	byDate: IDateMetrics[];
	byVersion: IVersionMetrics[];
	byPlatform: IPlatformMetrics[];
	byRegion: IRegionMetrics[];
	bySubscription: ISubscriptionMetrics[];
	byFeature: IFeatureMetrics[];
}

export interface IDateMetrics {
	date: Date;
	installs: number;
	uninstalls: number;
	activeUsers: number;
	revenue: number;
	downloads: number;
	errors: number;
}

export interface IVersionMetrics {
	version: string;
	installs: number;
	activeUsers: number;
	errors: number;
	rating: number;
	adoptionRate: number;
}

export interface IPlatformMetrics {
	platform: string;
	installs: number;
	activeUsers: number;
	marketShare: number;
}

export interface IRegionMetrics {
	region: string;
	country: string;
	installs: number;
	activeUsers: number;
	revenue: number;
}

export interface ISubscriptionMetrics {
	planId: string;
	planName: string;
	subscribers: number;
	revenue: number;
	churnRate: number;
	mrr: number;
	ltv: number;
}

export interface IFeatureMetrics {
	featureName: string;
	usageCount: number;
	uniqueUsers: number;
	avgSessionTime: number;
	popularityScore: number;
}

export interface IPluginPerformance {
	pluginId: string;
	loadTime: number;
	memoryUsage: number;
	cpuUsage: number;
	errorRate: number;
	uptime: number;
	responseTime: number;
	throughput: number;
	period: AnalyticsPeriod;
	lastUpdated: Date;
	details: IPerformanceDetails;
}

export interface IPerformanceDetails {
	avgLoadTime: number;
	maxLoadTime: number;
	minLoadTime: number;
	p95LoadTime: number;
	p99LoadTime: number;
	errorBreakdown: IErrorBreakdown[];
	memoryTrend: IMemoryTrend[];
	cpuTrend: ICpuTrend[];
}

export interface IErrorBreakdown {
	errorType: string;
	count: number;
	percentage: number;
	lastOccurred: Date;
}

export interface IMemoryTrend {
	timestamp: Date;
	usage: number;
	peak: number;
}

export interface ICpuTrend {
	timestamp: Date;
	usage: number;
	peak: number;
}

export interface IUserEngagement {
	pluginId: string;
	totalSessions: number;
	uniqueUsers: number;
	avgSessionDuration: number;
	bounceRate: number;
	returnVisitorRate: number;
	pageViews: number;
	clickThroughRate: number;
	conversionRate: number;
	period: AnalyticsPeriod;
	lastUpdated: Date;
	engagement: IEngagementDetails;
}

export interface IEngagementDetails {
	dailyActiveUsers: number;
	weeklyActiveUsers: number;
	monthlyActiveUsers: number;
	sessionsByDay: ISessionMetrics[];
	featureUsage: IFeatureUsageMetrics[];
	userJourney: IUserJourneyStep[];
}

export interface ISessionMetrics {
	date: Date;
	sessions: number;
	duration: number;
	bounceRate: number;
}

export interface IFeatureUsageMetrics {
	feature: string;
	usage: number;
	uniqueUsers: number;
	timeSpent: number;
}

export interface IUserJourneyStep {
	step: string;
	users: number;
	dropoffRate: number;
	conversionRate: number;
}

export interface IRevenueAnalytics {
	pluginId: string;
	totalRevenue: number;
	monthlyRecurringRevenue: number;
	annualRecurringRevenue: number;
	averageRevenuePerUser: number;
	customerLifetimeValue: number;
	churnRate: number;
	growthRate: number;
	refundRate: number;
	period: AnalyticsPeriod;
	lastUpdated: Date;
	breakdown: IRevenueBreakdown;
}

export interface IRevenueBreakdown {
	byPlan: IPlanRevenue[];
	byRegion: IRegionRevenue[];
	byChannel: IChannelRevenue[];
	byPeriod: IPeriodRevenue[];
	forecasts: IRevenueForecast[];
}

export interface IPlanRevenue {
	planId: string;
	planName: string;
	revenue: number;
	subscribers: number;
	mrr: number;
	arr: number;
	churn: number;
}

export interface IRegionRevenue {
	region: string;
	revenue: number;
	subscribers: number;
	growthRate: number;
}

export interface IChannelRevenue {
	channel: string;
	revenue: number;
	conversions: number;
	cost: number;
	roi: number;
}

export interface IPeriodRevenue {
	period: Date;
	revenue: number;
	subscriptions: number;
	churn: number;
	growth: number;
}

export interface IRevenueForecast {
	period: Date;
	forecastRevenue: number;
	confidence: number;
	actualRevenue?: number;
}

export interface IAnalyticsReport {
	id: string;
	name: string;
	description?: string;
	pluginId: string;
	type: ReportType;
	metrics: string[];
	filters: IReportFilter[];
	period: AnalyticsPeriod;
	format: ReportFormat;
	schedule?: IReportSchedule;
	isPublic: boolean;
	createdAt: Date;
	updatedAt: Date;
	lastGenerated?: Date;
	data?: any;
}

export interface IReportFilter {
	field: string;
	operator: FilterOperator;
	value: any;
	type: FilterType;
}

export interface IReportSchedule {
	enabled: boolean;
	frequency: ScheduleFrequency;
	time: string;
	timezone: string;
	recipients: string[];
}

export enum PluginEventType {
	INSTALL = 'install',
	UNINSTALL = 'uninstall',
	ACTIVATE = 'activate',
	DEACTIVATE = 'deactivate',
	UPDATE = 'update',
	USAGE = 'usage',
	ERROR = 'error',
	PERFORMANCE = 'performance',
	FEATURE_USE = 'feature_use',
	SETTINGS_CHANGE = 'settings_change',
	SUBSCRIPTION_START = 'subscription_start',
	SUBSCRIPTION_END = 'subscription_end',
	PAYMENT = 'payment',
	REFUND = 'refund',
	REVIEW = 'review',
	SUPPORT = 'support'
}

export enum AnalyticsPeriod {
	HOUR = 'hour',
	DAY = 'day',
	WEEK = 'week',
	MONTH = 'month',
	QUARTER = 'quarter',
	YEAR = 'year',
	CUSTOM = 'custom'
}

export enum ReportType {
	USAGE = 'usage',
	PERFORMANCE = 'performance',
	REVENUE = 'revenue',
	ENGAGEMENT = 'engagement',
	CONVERSION = 'conversion',
	RETENTION = 'retention',
	CUSTOM = 'custom'
}

export enum ReportFormat {
	JSON = 'json',
	CSV = 'csv',
	PDF = 'pdf',
	EXCEL = 'excel',
	CHART = 'chart'
}

export enum FilterOperator {
	EQUALS = 'equals',
	NOT_EQUALS = 'not_equals',
	GREATER_THAN = 'greater_than',
	LESS_THAN = 'less_than',
	GREATER_EQUAL = 'greater_equal',
	LESS_EQUAL = 'less_equal',
	CONTAINS = 'contains',
	NOT_CONTAINS = 'not_contains',
	STARTS_WITH = 'starts_with',
	ENDS_WITH = 'ends_with',
	IN = 'in',
	NOT_IN = 'not_in',
	BETWEEN = 'between',
	IS_NULL = 'is_null',
	IS_NOT_NULL = 'is_not_null'
}

export enum FilterType {
	STRING = 'string',
	NUMBER = 'number',
	DATE = 'date',
	BOOLEAN = 'boolean',
	ARRAY = 'array'
}

export enum ScheduleFrequency {
	DAILY = 'daily',
	WEEKLY = 'weekly',
	MONTHLY = 'monthly',
	QUARTERLY = 'quarterly',
	YEARLY = 'yearly'
}

@Injectable({
	providedIn: 'root'
})
export class PluginAnalyticsService {
	private readonly endPoint = `${API_PREFIX}/plugin-analytics`;
	private readonly metricsEndPoint = `${API_PREFIX}/plugin-metrics`;
	private readonly reportsEndPoint = `${API_PREFIX}/plugin-reports`;

	private readonly metricsCache$ = new BehaviorSubject<Map<string, IPluginMetrics>>(new Map());
	private readonly performanceCache$ = new BehaviorSubject<Map<string, IPluginPerformance>>(new Map());

	constructor(private readonly http: HttpClient) {}

	// Event Tracking
	public trackEvent(event: Omit<IPluginAnalytics, 'id' | 'timestamp'>): Observable<IPluginAnalytics> {
		return this.http.post<IPluginAnalytics>(`${this.endPoint}/events`, {
			...event,
			timestamp: new Date()
		});
	}

	public trackBulkEvents(events: Omit<IPluginAnalytics, 'id' | 'timestamp'>[]): Observable<IPluginAnalytics[]> {
		const eventsWithTimestamp = events.map((event) => ({
			...event,
			timestamp: new Date()
		}));

		return this.http.post<IPluginAnalytics[]>(`${this.endPoint}/events/bulk`, eventsWithTimestamp);
	}

	public getEvents<T>(params = {} as T): Observable<IPagination<IPluginAnalytics>> {
		return this.http
			.get<IPagination<IPluginAnalytics>>(`${this.endPoint}/events`, {
				params: toParams(params)
			})
			.pipe(shareReplay(1));
	}

	public getPluginEvents(
		pluginId: string,
		startDate?: Date,
		endDate?: Date,
		eventTypes?: PluginEventType[]
	): Observable<IPluginAnalytics[]> {
		const params: any = {};
		if (startDate) params.startDate = startDate.toISOString();
		if (endDate) params.endDate = endDate.toISOString();
		if (eventTypes?.length) params.eventTypes = eventTypes.join(',');

		return this.http
			.get<IPluginAnalytics[]>(`${this.endPoint}/plugins/${pluginId}/events`, {
				params: toParams(params)
			})
			.pipe(shareReplay(1));
	}

	// Metrics
	public getPluginMetrics(
		pluginId: string,
		period: AnalyticsPeriod = AnalyticsPeriod.MONTH,
		startDate?: Date,
		endDate?: Date
	): Observable<IPluginMetrics> {
		const params: any = { period };
		if (startDate) params.startDate = startDate.toISOString();
		if (endDate) params.endDate = endDate.toISOString();

		return this.http
			.get<IPluginMetrics>(`${this.metricsEndPoint}/plugins/${pluginId}`, {
				params: toParams(params)
			})
			.pipe(shareReplay(1));
	}

	public getAllPluginMetrics(
		period: AnalyticsPeriod = AnalyticsPeriod.MONTH,
		limit?: number
	): Observable<IPluginMetrics[]> {
		const params: any = { period };
		if (limit) params.limit = limit;

		return this.http
			.get<IPluginMetrics[]>(`${this.metricsEndPoint}/plugins`, {
				params: toParams(params)
			})
			.pipe(shareReplay(1));
	}

	public getPluginPerformance(
		pluginId: string,
		period: AnalyticsPeriod = AnalyticsPeriod.MONTH
	): Observable<IPluginPerformance> {
		const params = { period };

		return this.http
			.get<IPluginPerformance>(`${this.metricsEndPoint}/plugins/${pluginId}/performance`, {
				params: toParams(params)
			})
			.pipe(shareReplay(1));
	}

	public getPluginEngagement(
		pluginId: string,
		period: AnalyticsPeriod = AnalyticsPeriod.MONTH
	): Observable<IUserEngagement> {
		const params = { period };

		return this.http
			.get<IUserEngagement>(`${this.metricsEndPoint}/plugins/${pluginId}/engagement`, {
				params: toParams(params)
			})
			.pipe(shareReplay(1));
	}

	public getPluginRevenue(
		pluginId: string,
		period: AnalyticsPeriod = AnalyticsPeriod.MONTH
	): Observable<IRevenueAnalytics> {
		const params = { period };

		return this.http
			.get<IRevenueAnalytics>(`${this.metricsEndPoint}/plugins/${pluginId}/revenue`, {
				params: toParams(params)
			})
			.pipe(shareReplay(1));
	}

	// Comprehensive Dashboard Data
	public getPluginDashboard(
		pluginId: string,
		period: AnalyticsPeriod = AnalyticsPeriod.MONTH
	): Observable<{
		metrics: IPluginMetrics;
		performance: IPluginPerformance;
		engagement: IUserEngagement;
		revenue: IRevenueAnalytics;
	}> {
		return combineLatest([
			this.getPluginMetrics(pluginId, period),
			this.getPluginPerformance(pluginId, period),
			this.getPluginEngagement(pluginId, period),
			this.getPluginRevenue(pluginId, period)
		]).pipe(
			map(([metrics, performance, engagement, revenue]) => ({
				metrics,
				performance,
				engagement,
				revenue
			}))
		);
	}

	public getMarketplaceDashboard(period: AnalyticsPeriod = AnalyticsPeriod.MONTH): Observable<{
		totalPlugins: number;
		totalInstalls: number;
		totalRevenue: number;
		topPlugins: IPluginMetrics[];
		recentEvents: IPluginAnalytics[];
		trends: any;
	}> {
		const params = { period };

		return this.http
			.get<{
				totalPlugins: number;
				totalInstalls: number;
				totalRevenue: number;
				topPlugins: IPluginMetrics[];
				recentEvents: IPluginAnalytics[];
				trends: any;
			}>(`${this.metricsEndPoint}/marketplace/dashboard`, {
				params: toParams(params)
			})
			.pipe(shareReplay(1));
	}

	// Real-time Analytics
	public getRealTimeMetrics(pluginId: string): Observable<{
		activeUsers: number;
		currentSessions: number;
		eventsPerSecond: number;
		errorRate: number;
		responseTime: number;
	}> {
		return this.http.get<{
			activeUsers: number;
			currentSessions: number;
			eventsPerSecond: number;
			errorRate: number;
			responseTime: number;
		}>(`${this.metricsEndPoint}/plugins/${pluginId}/realtime`);
	}

	public getMarketplaceRealTime(): Observable<{
		totalActiveUsers: number;
		totalSessions: number;
		eventsPerSecond: number;
		topActivePlugins: Array<{
			pluginId: string;
			name: string;
			activeUsers: number;
		}>;
	}> {
		return this.http.get<{
			totalActiveUsers: number;
			totalSessions: number;
			eventsPerSecond: number;
			topActivePlugins: Array<{
				pluginId: string;
				name: string;
				activeUsers: number;
			}>;
		}>(`${this.metricsEndPoint}/marketplace/realtime`);
	}

	// Comparative Analytics
	public comparePlugins(
		pluginIds: string[],
		metrics: string[],
		period: AnalyticsPeriod = AnalyticsPeriod.MONTH
	): Observable<{
		plugins: string[];
		metrics: string[];
		data: Record<string, Record<string, number>>;
		insights: string[];
	}> {
		const params = {
			pluginIds: pluginIds.join(','),
			metrics: metrics.join(','),
			period
		};

		return this.http
			.get<{
				plugins: string[];
				metrics: string[];
				data: Record<string, Record<string, number>>;
				insights: string[];
			}>(`${this.metricsEndPoint}/compare`, {
				params: toParams(params)
			})
			.pipe(shareReplay(1));
	}

	public getMarketTrends(
		category?: string,
		period: AnalyticsPeriod = AnalyticsPeriod.MONTH
	): Observable<{
		totalMarketSize: number;
		growthRate: number;
		topCategories: Array<{
			category: string;
			plugins: number;
			installs: number;
			revenue: number;
			growth: number;
		}>;
		emergingPlugins: Array<{
			pluginId: string;
			name: string;
			growth: number;
			installs: number;
		}>;
		seasonality: Record<string, number>;
	}> {
		const params: any = { period };
		if (category) params.category = category;

		return this.http
			.get<{
				totalMarketSize: number;
				growthRate: number;
				topCategories: Array<{
					category: string;
					plugins: number;
					installs: number;
					revenue: number;
					growth: number;
				}>;
				emergingPlugins: Array<{
					pluginId: string;
					name: string;
					growth: number;
					installs: number;
				}>;
				seasonality: Record<string, number>;
			}>(`${this.metricsEndPoint}/marketplace/trends`, {
				params: toParams(params)
			})
			.pipe(shareReplay(1));
	}

	// Reports
	public createReport(
		report: Omit<IAnalyticsReport, 'id' | 'createdAt' | 'updatedAt'>
	): Observable<IAnalyticsReport> {
		return this.http.post<IAnalyticsReport>(this.reportsEndPoint, {
			...report,
			createdAt: new Date(),
			updatedAt: new Date()
		});
	}

	public updateReport(id: string, report: Partial<IAnalyticsReport>): Observable<IAnalyticsReport> {
		return this.http.put<IAnalyticsReport>(`${this.reportsEndPoint}/${id}`, {
			...report,
			updatedAt: new Date()
		});
	}

	public deleteReport(id: string): Observable<void> {
		return this.http.delete<void>(`${this.reportsEndPoint}/${id}`);
	}

	public getReports<T>(params = {} as T): Observable<IPagination<IAnalyticsReport>> {
		return this.http
			.get<IPagination<IAnalyticsReport>>(this.reportsEndPoint, {
				params: toParams(params)
			})
			.pipe(shareReplay(1));
	}

	public getReport(id: string): Observable<IAnalyticsReport> {
		return this.http.get<IAnalyticsReport>(`${this.reportsEndPoint}/${id}`);
	}

	public generateReport(id: string): Observable<{
		report: IAnalyticsReport;
		data: any;
		generatedAt: Date;
	}> {
		return this.http.post<{
			report: IAnalyticsReport;
			data: any;
			generatedAt: Date;
		}>(`${this.reportsEndPoint}/${id}/generate`, {});
	}

	public downloadReport(id: string, format: ReportFormat = ReportFormat.PDF): Observable<Blob> {
		return this.http.get(`${this.reportsEndPoint}/${id}/download`, {
			params: { format },
			responseType: 'blob'
		});
	}

	public scheduleReport(id: string, schedule: IReportSchedule): Observable<IAnalyticsReport> {
		return this.http.put<IAnalyticsReport>(`${this.reportsEndPoint}/${id}/schedule`, schedule);
	}

	public getScheduledReports(): Observable<IAnalyticsReport[]> {
		return this.http.get<IAnalyticsReport[]>(`${this.reportsEndPoint}/scheduled`).pipe(shareReplay(1));
	}

	// Export/Import
	public exportAnalytics(
		pluginId: string,
		startDate: Date,
		endDate: Date,
		format: 'json' | 'csv' = 'json'
	): Observable<Blob> {
		const params = {
			startDate: startDate.toISOString(),
			endDate: endDate.toISOString(),
			format
		};

		return this.http.get(`${this.endPoint}/plugins/${pluginId}/export`, {
			params: toParams(params),
			responseType: 'blob'
		});
	}

	public exportMarketplaceAnalytics(
		startDate: Date,
		endDate: Date,
		format: 'json' | 'csv' = 'json'
	): Observable<Blob> {
		const params = {
			startDate: startDate.toISOString(),
			endDate: endDate.toISOString(),
			format
		};

		return this.http.get(`${this.endPoint}/marketplace/export`, {
			params: toParams(params),
			responseType: 'blob'
		});
	}

	// Alerts and Monitoring
	public createAlert(alert: {
		pluginId: string;
		name: string;
		description?: string;
		metric: string;
		condition: string;
		threshold: number;
		recipients: string[];
		isActive: boolean;
	}): Observable<any> {
		return this.http.post(`${this.endPoint}/alerts`, alert);
	}

	public getAlerts(pluginId?: string): Observable<any[]> {
		const params = pluginId ? { pluginId } : {};
		return this.http
			.get<any[]>(`${this.endPoint}/alerts`, {
				params: toParams(params)
			})
			.pipe(shareReplay(1));
	}

	public updateAlert(id: string, alert: any): Observable<any> {
		return this.http.put(`${this.endPoint}/alerts/${id}`, alert);
	}

	public deleteAlert(id: string): Observable<void> {
		return this.http.delete<void>(`${this.endPoint}/alerts/${id}`);
	}

	// Utility Methods
	public formatMetricValue(value: number, metric: string): string {
		switch (metric) {
			case 'revenue':
			case 'mrr':
			case 'arr':
			case 'ltv':
				return new Intl.NumberFormat('en-US', {
					style: 'currency',
					currency: 'USD'
				}).format(value);
			case 'percentage':
			case 'conversionRate':
			case 'churnRate':
			case 'retentionRate':
				return `${(value * 100).toFixed(2)}%`;
			case 'duration':
			case 'loadTime':
			case 'responseTime':
				return this.formatDuration(value);
			case 'memory':
			case 'memoryUsage':
				return this.formatBytes(value);
			default:
				return new Intl.NumberFormat('en-US').format(value);
		}
	}

	public formatDuration(milliseconds: number): string {
		if (milliseconds < 1000) {
			return `${milliseconds}ms`;
		} else if (milliseconds < 60000) {
			return `${(milliseconds / 1000).toFixed(2)}s`;
		} else {
			const minutes = Math.floor(milliseconds / 60000);
			const seconds = ((milliseconds % 60000) / 1000).toFixed(0);
			return `${minutes}m ${seconds}s`;
		}
	}

	public formatBytes(bytes: number): string {
		const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
		if (bytes === 0) return '0 B';
		const i = Math.floor(Math.log(bytes) / Math.log(1024));
		return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
	}

	public getMetricColor(
		metric: string,
		value: number,
		thresholds?: {
			good: number;
			warning: number;
			critical: number;
		}
	): string {
		if (!thresholds) {
			return 'primary';
		}

		const isInverse = ['errorRate', 'churnRate', 'bounceRate', 'loadTime'].includes(metric);

		if (isInverse) {
			if (value <= thresholds.good) return 'success';
			if (value <= thresholds.warning) return 'warning';
			return 'danger';
		} else {
			if (value >= thresholds.good) return 'success';
			if (value >= thresholds.warning) return 'warning';
			return 'danger';
		}
	}

	public getMetricIcon(metric: string): string {
		const icons: Record<string, string> = {
			installs: 'download-outline',
			uninstalls: 'close-outline',
			activeUsers: 'people-outline',
			revenue: 'cash-outline',
			rating: 'star-outline',
			performance: 'flash-outline',
			errors: 'warning-outline',
			engagement: 'heart-outline',
			conversion: 'trending-up-outline',
			retention: 'repeat-outline',
			churn: 'trending-down-outline',
			growth: 'arrow-up-outline',
			sessions: 'time-outline',
			pageViews: 'eye-outline',
			clickThrough: 'hand-left-outline',
			bounceRate: 'exit-outline',
			loadTime: 'hourglass-outline',
			memoryUsage: 'hardware-chip-outline',
			cpuUsage: 'speedometer-outline'
		};

		return icons[metric] || 'analytics-outline';
	}

	public getMetricTrend(
		current: number,
		previous: number
	): {
		direction: 'up' | 'down' | 'stable';
		percentage: number;
		color: string;
	} {
		if (previous === 0) {
			return {
				direction: current > 0 ? 'up' : 'stable',
				percentage: 0,
				color: current > 0 ? 'success' : 'basic'
			};
		}

		const percentage = ((current - previous) / previous) * 100;
		const direction = percentage > 5 ? 'up' : percentage < -5 ? 'down' : 'stable';
		const color = direction === 'up' ? 'success' : direction === 'down' ? 'danger' : 'basic';

		return {
			direction,
			percentage: Math.abs(percentage),
			color
		};
	}

	public calculateGrowthRate(values: number[]): number {
		if (values.length < 2) return 0;

		const firstValue = values[0];
		const lastValue = values[values.length - 1];

		if (firstValue === 0) return 0;

		return ((lastValue - firstValue) / firstValue) * 100;
	}

	public getDefaultThresholds(metric: string): {
		good: number;
		warning: number;
		critical: number;
	} {
		const thresholds: Record<string, { good: number; warning: number; critical: number }> = {
			errorRate: { good: 1, warning: 5, critical: 10 },
			loadTime: { good: 1000, warning: 3000, critical: 5000 },
			churnRate: { good: 2, warning: 5, critical: 10 },
			conversionRate: { good: 10, warning: 5, critical: 2 },
			retentionRate: { good: 80, warning: 60, critical: 40 },
			bounceRate: { good: 25, warning: 50, critical: 75 },
			memoryUsage: { good: 50, warning: 75, critical: 90 },
			cpuUsage: { good: 50, warning: 75, critical: 90 }
		};

		return thresholds[metric] || { good: 80, warning: 60, critical: 40 };
	}
}
