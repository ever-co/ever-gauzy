import '@angular/compiler';
import { COMPILER_OPTIONS, NgModule, provideZonelessChangeDetection } from '@angular/core';
import { getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';

class ZonelessTestModule {}
NgModule({ providers: [provideZonelessChangeDetection()] })(ZonelessTestModule);

getTestBed().initTestEnvironment(
	[BrowserTestingModule, ZonelessTestModule],
	platformBrowserTesting([{ provide: COMPILER_OPTIONS, useValue: {}, multi: true }]),
	{ errorOnUnknownElements: true, errorOnUnknownProperties: true }
);

// eslint-disable-next-line no-console
console.log('ZZQ SETUP: env initialised =', !!(getTestBed() as unknown as { platform: unknown }).platform);
