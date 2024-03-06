'use strict';

import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPTraceExporter as OTLPTraceExporterGrpc } from '@opentelemetry/exporter-trace-otlp-grpc';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { RedisInstrumentation } from '@opentelemetry/instrumentation-redis';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { MySQL2Instrumentation } from '@opentelemetry/instrumentation-mysql2';
import { BatchSpanProcessor, SimpleSpanProcessor, SpanExporter } from '@opentelemetry/sdk-trace-base';
import { HoneycombSDK } from '@honeycombio/opentelemetry-node';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

let sdk: any;

let traceExporter: SpanExporter;
let url: string;

if (process.env.OTEL_ENABLED === 'true') {
	if (process.env.NODE_ENV === 'development') {
		// Enable Tracing logging for debugging
		diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
	}

	let serviceName: string;

	if (process.env.OTEL_SERVICE_NAME) {
		serviceName = process.env.OTEL_SERVICE_NAME;
	} else {
		let sName = 'Ever Gauzy API';

		if (process.env.CLOUD_PROVIDER) {
			const providerName = process.env.CLOUD_PROVIDER;
			console.log('Tracing Cloud Provider: ' + providerName);
			sName = sName + '-' + providerName;
		}

		// Function to format serviceName
		function formatServiceName(name) {
			// Convert to lowercase
			let formattedName = name.toLowerCase();
			// Replace spaces and special characters with hyphens
			formattedName = formattedName.replace(/[\s\W-]+/g, '-');
			return formattedName;
		}

		serviceName = formatServiceName(sName);
	}

	console.log('Tracing service name: ' + serviceName);

	url = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;

	// If OTEL_PROVIDER is not set, use Jaeger by default (as long as OTEL_ENABLED is true of course)
	if (!process.env.OTEL_PROVIDER || process.env.OTEL_PROVIDER === 'jaeger') {
		const isGrpc = process.env.OTEL_EXPORTER_OTLP_PROTOCOL === 'grpc';

		// Configure the SDK to export telemetry data to a locally running Jaeger by default, unless OTEL_EXPORTER_OTLP_TRACES_ENDPOINT is set
		if (!url) url = isGrpc ? 'grpc://localhost:14250' : 'http://localhost:14268/api/traces';

		const exporterOptions = {
			url: url
		};

		if (!isGrpc) {
			traceExporter = new OTLPTraceExporter(exporterOptions);
		} else {
			traceExporter = new OTLPTraceExporterGrpc(exporterOptions);
		}

		console.log('Tracing Enabled with Jaeger');
	}

	if (process.env.OTEL_PROVIDER === 'signoz') {
		// Important for Tracing with SigNoz:
		// 1. Define env var - OTEL_EXPORTER_OTLP_HEADERS="signoz-access-token=<SIGNOZ_INGESTION_KEY>"
		// 2. Set OTEL_ENABLED=true
		// Read docs: https://signoz.io/docs/instrumentation/nestjs

		if (!url) url = 'https://ingest.us.signoz.cloud:443/v1/traces';

		const exporterOptions = {
			url: url
		};

		traceExporter = new OTLPTraceExporter(exporterOptions);

		console.log('Tracing Enabled with SigNoz');
	}

	if (process.env.OTEL_PROVIDER === 'honeycomb') {
		if (!url) url = `https://api.honeycomb.io/v1/traces`;

		console.log('Using Honeycomb API Key: ' + process.env.HONEYCOMB_API_KEY);

		const exporterOptions = {
			url: url,
			headers: {
				'x-honeycomb-team': process.env.HONEYCOMB_API_KEY
			}
		};

		// https://docs.honeycomb.io/getting-data-in/opentelemetry/node-distro/

		traceExporter = new OTLPTraceExporter(exporterOptions);

		console.log('Tracing Enabled with Honeycomb');
	}

	console.log('Tracing URL: ' + url);

	console.log('Tracing Headers: ' + process.env.OTEL_EXPORTER_OTLP_HEADERS);

	let spanProcessor;

	if (process.env.NODE_ENV === `development`) {
		spanProcessor = new SimpleSpanProcessor(traceExporter);
	} else {
		spanProcessor = new BatchSpanProcessor(traceExporter);
	}

	const isAuto = true;

	let instrumentations: any[];
	let instrumentationNames: string[];

	if (isAuto) {
		const autoInst = getNodeAutoInstrumentations({
			// we recommend disabling fs autoinstrumentation since it can be noisy
			// and expensive during startup
			'@opentelemetry/instrumentation-fs': {
				enabled: false
			}
		});

		instrumentations = [autoInst];
		instrumentationNames = autoInst.map((i) => i.instrumentationName);
	} else {
		const ins = [];
		const insNames: string[] = [];

		ins.push(new HttpInstrumentation());
		insNames.push('HttpInstrumentation');

		ins.push(new ExpressInstrumentation());
		insNames.push('ExpressInstrumentation');

		ins.push(new NestInstrumentation());
		insNames.push('NestInstrumentation');

		if (process.env.REDIS_ENABLED === 'true') {
			ins.push(new RedisInstrumentation());
			insNames.push('RedisInstrumentation');
		}

		if (process.env.DB_TYPE === 'postgres') {
			ins.push(new PgInstrumentation());
			insNames.push('PgInstrumentation');
		}

		if (process.env.DB_TYPE === 'mysql') {
			ins.push(new MySQL2Instrumentation());
			insNames.push('MySQL2Instrumentation');
		}

		instrumentations = [ins];
		instrumentationNames = insNames;
	}

	console.log('Tracing Enabled Instrumentations:', instrumentationNames.join(', '));

	if (process.env.OTEL_PROVIDER === 'honeycomb') {
		const HoneycombSDKConfig = {
			apiKey: process.env.HONEYCOMB_API_KEY,
			serviceName: serviceName,
			traceExporter: traceExporter,
			// spanProcessors: [spanProcessor],
			instrumentations: instrumentations,
			localVisualizations: process.env.NODE_ENV === 'development'
		};

		sdk = new HoneycombSDK(HoneycombSDKConfig);

		console.log('Tracing SDK initialized for Honeycomb');
	} else {
		// configure the SDK to export telemetry data to the console (for debugging purposes only)
		// const consoleExporter = new ConsoleSpanExporter(); // deepscan-disable-line UNUSED_DECL
		// traceExporter = consoleExporter

		const nodeSDKConfig = {
			serviceName: serviceName,
			traceExporter: traceExporter,
			// spanProcessors: [spanProcessor],
			instrumentations: instrumentations,
			localVisualizations: process.env.NODE_ENV === 'development'
		};

		sdk = new NodeSDK(nodeSDKConfig);

		console.log('Tracing SDK initialized');
	}
}

export default sdk;
