'use strict';

import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

// Important for Tracing:
// 1. Define env var - OTEL_EXPORTER_OTLP_HEADERS="signoz-access-token=<SIGNOZ_INGESTION_KEY>"
// 2. Set OTEL_ENABLED=true
// Read docs: https://signoz.io/docs/instrumentation/nestjs/

// Enable logging for debugging
// import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
// diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

// Configure the SDK to export telemetry data to the console
// Enable all auto-instrumentations from the meta package
const exporterOptions = {
	url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'https://ingest.us.signoz.cloud:443/v1/traces'
};

const traceExporter = new OTLPTraceExporter(exporterOptions);

const sdk = new NodeSDK({
	traceExporter,
	instrumentations: [getNodeAutoInstrumentations()],
	resource: new Resource({
		[SemanticResourceAttributes.SERVICE_NAME]: 'Ever Gauzy API'
	})
});

if (process.env.OTEL_ENABLED) {
	// initialize the SDK and register with the OpenTelemetry API
	// this enables the API to record telemetry
	sdk.start();
}

export default sdk;
