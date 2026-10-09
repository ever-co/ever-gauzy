import { captureBootLogs } from '../core/testing/boot-logging/boot-log.fixtures';

// The tracer configures itself at import time. Every OpenTelemetry dependency is replaced so that
// importing it only exercises the configuration and logging logic, never a real exporter or SDK.
jest.mock('@opentelemetry/auto-instrumentations-node', () => ({ getNodeAutoInstrumentations: jest.fn(() => []) }));
jest.mock('@opentelemetry/exporter-trace-otlp-http', () => ({ OTLPTraceExporter: jest.fn() }));
jest.mock('@opentelemetry/exporter-trace-otlp-grpc', () => ({ OTLPTraceExporter: jest.fn() }));
jest.mock('@opentelemetry/sdk-node', () => ({}));
jest.mock('@opentelemetry/instrumentation-http', () => ({ HttpInstrumentation: jest.fn() }));
jest.mock('@opentelemetry/instrumentation-express', () => ({ ExpressInstrumentation: jest.fn() }));
jest.mock('@opentelemetry/instrumentation-nestjs-core', () => ({ NestInstrumentation: jest.fn() }));
jest.mock('@opentelemetry/instrumentation-redis', () => ({ RedisInstrumentation: jest.fn() }));
jest.mock('@opentelemetry/instrumentation-pg', () => ({ PgInstrumentation: jest.fn() }));
jest.mock('@opentelemetry/instrumentation-mysql2', () => ({ MySQL2Instrumentation: jest.fn() }));
jest.mock('@opentelemetry/sdk-trace-base', () => ({
	BatchSpanProcessor: jest.fn(),
	ConsoleSpanExporter: jest.fn(),
	SimpleSpanProcessor: jest.fn()
}));
jest.mock('@honeycombio/opentelemetry-node', () => ({ HoneycombSDK: jest.fn() }));
jest.mock('@opentelemetry/api', () => ({
	diag: { setLogger: jest.fn() },
	DiagConsoleLogger: jest.fn(),
	DiagLogLevel: { DEBUG: 'DEBUG' }
}));
jest.mock('@opentelemetry/exporter-zipkin', () => ({ ZipkinExporter: jest.fn() }));
jest.mock('opentelemetry-instrumentation-typeorm', () => ({ TypeormInstrumentation: jest.fn() }));
jest.mock('@opentelemetry/sdk-trace-node', () => ({
	NodeTracerProvider: jest.fn(() => ({ register: jest.fn(), addSpanProcessor: jest.fn(), shutdown: jest.fn() }))
}));
jest.mock('@opentelemetry/resources', () => ({ Resource: jest.fn() }));
jest.mock('@opentelemetry/semantic-conventions', () => ({
	SemanticResourceAttributes: { SERVICE_NAME: 'service.name' }
}));
jest.mock('@opentelemetry/instrumentation', () => ({ registerInstrumentations: jest.fn() }));

/**
 * With tracing enabled the tracer used to print the Honeycomb API key and the raw
 * `OTEL_EXPORTER_OTLP_HEADERS` value (ingestion keys) to stdout at boot. It must now log only
 * whether the key is set, the header names, and the endpoint without credentials - while the
 * exporters still receive the real values.
 */
describe('tracer boot logging', () => {
	const TRACER_ENV_KEYS = [
		'OTEL_ENABLED',
		'OTEL_PROVIDER',
		'OTEL_SERVICE_NAME',
		'OTEL_EXPORTER_OTLP_TRACES_ENDPOINT',
		'OTEL_EXPORTER_OTLP_PROTOCOL',
		'OTEL_EXPORTER_OTLP_HEADERS',
		'HONEYCOMB_API_KEY',
		'HONEYCOMB_ENABLE_LOCAL_VISUALIZATIONS',
		'ASPECTO_API_KEY',
		'CLOUD_PROVIDER',
		'DB_ORM',
		'DB_TYPE',
		'REDIS_ENABLED'
	];
	const logs = captureBootLogs(TRACER_ENV_KEYS);

	/** Imports the tracer in a fresh module registry, so its import-time configuration runs again. */
	const loadTracer = () => {
		let otlpHttpExporter: jest.Mock;
		let honeycombSdk: jest.Mock;
		jest.isolateModules(() => {
			require('./tracer');
			otlpHttpExporter = require('@opentelemetry/exporter-trace-otlp-http').OTLPTraceExporter;
			honeycombSdk = require('@honeycombio/opentelemetry-node').HoneycombSDK;
		});
		return { otlpHttpExporter, honeycombSdk };
	};

	it('never logs the Honeycomb API key, the OTLP header values or endpoint credentials', () => {
		const API_KEY = 'dummy-honeycomb-api-key';
		const HEADER_KEY = 'dummy-otlp-header-key';
		const ENDPOINT_PASSWORD = 'dummy-endpoint-password';
		process.env.OTEL_ENABLED = 'true';
		process.env.OTEL_PROVIDER = 'honeycomb';
		process.env.HONEYCOMB_API_KEY = API_KEY;
		process.env.OTEL_EXPORTER_OTLP_HEADERS = `x-honeycomb-team=${HEADER_KEY}`;
		process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = `https://collector:${ENDPOINT_PASSWORD}@otel.example.com/v1/traces`;

		const { otlpHttpExporter, honeycombSdk } = loadTracer();

		// The exporter and SDK still receive the real key and endpoint - only the log output changes.
		expect(otlpHttpExporter).toHaveBeenCalledWith(
			expect.objectContaining({
				url: `https://collector:${ENDPOINT_PASSWORD}@otel.example.com/v1/traces`,
				headers: { 'x-honeycomb-team': API_KEY }
			})
		);
		expect(honeycombSdk).toHaveBeenCalledWith(expect.objectContaining({ apiKey: API_KEY }));

		// Control: the diagnostic lines are still emitted, so the absence checks below are meaningful.
		expect(logs.lines).toContain('Using Honeycomb API Key: ***');
		expect(logs.lines).toContain('Tracing URL: https://collector:***@otel.example.com/v1/traces');
		expect(logs.lines).toContain('Tracing Headers: x-honeycomb-team=***');

		const output = logs.lines.join('\n');
		expect(output).not.toContain(API_KEY);
		expect(output).not.toContain(HEADER_KEY);
		expect(output).not.toContain(ENDPOINT_PASSWORD);
	});

	it('logs the SigNoz ingestion header by name only and keeps a credential-free URL as-is', () => {
		const INGESTION_KEY = 'dummy-signoz-ingestion-key';
		process.env.OTEL_ENABLED = 'true';
		process.env.OTEL_PROVIDER = 'signoz';
		process.env.OTEL_EXPORTER_OTLP_HEADERS = `signoz-access-token=${INGESTION_KEY}`;

		loadTracer();

		expect(logs.lines).toContain('Tracing URL: https://ingest.us.signoz.cloud:443/v1/traces');
		expect(logs.lines).toContain('Tracing Headers: signoz-access-token=***');
		expect(logs.lines.join('\n')).not.toContain(INGESTION_KEY);
	});
});
