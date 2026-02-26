# @gauzy/plugin-ui-react

React-to-Angular bridge for Gauzy UI plugins. Renders React 19 components inside Angular with full access to Angular services via the dependency injection system.

## Overview

This package provides the glue layer between Angular and React. It is intentionally separate from `@gauzy/plugin-ui` (the core plugin infrastructure) so that `plugin-ui` remains a pure-Angular package with no React peer dependency.

```
@gauzy/plugin-ui          (core, Angular-only)
       │
       └── @gauzy/plugin-ui-react   (React bridge)
                  │
                  └── @gauzy/plugin-react-ui   (example React plugin)
```

## Installation

```bash
yarn add @gauzy/plugin-ui-react
```

## Peer Dependencies

- `@angular/core` ≥ 21
- `@gauzy/plugin-ui` (workspace peer)
- `react` ≥ 19
- `react-dom` ≥ 19
- `rxjs` ≥ 7

---

## Angular Directives

### `ReactHostDirective`

Renders a React component synchronously inside any Angular template.

```html
<!-- host element receives the React tree -->
<div [reactHost]="MyReactComponent" [props]="myProps"></div>

<!-- with extra context values -->
<div [reactHost]="MyReactComponent" [props]="myProps" [context]="{ theme: 'dark' }"></div>
```

### `LazyReactHostDirective`

Lazy-loads a React component via dynamic `import()` for code-splitting.

```html
<div
  [reactLazyHost]="loadKanban"
  [props]="kanbanProps">
</div>
```

```ts
loadKanban = () => import('./kanban/KanbanBoard').then(m => m);
```

---

## React Hooks

### `useInjector()`

Access Angular services from inside any React component rendered via the bridge.

```tsx
import { useInjector } from '@gauzy/plugin-ui-react';
import { Router } from '@angular/router';

function MyWidget() {
  const router = useInjector(Router);

  return <button onClick={() => router.navigate(['/home'])}>Go Home</button>;
}
```

Without a token, returns the raw `Injector`:

```tsx
const injector = useInjector();
const http = injector.get(HttpClient);
```

### `usePluginEvents(pluginId?)`

Inter-plugin event bus from React. Subscribe and emit events across plugins.

```tsx
import { usePluginEvents } from '@gauzy/plugin-ui-react';

function MyWidget() {
  const events = usePluginEvents('my-plugin');

  useEffect(() => {
    const sub = events.on('time-tracked').subscribe(event => {
      console.log('Payload:', event.payload);
    });
    return () => sub.unsubscribe();
  }, [events]);

  return <button onClick={() => events.emit('widget-clicked', { id: 1 })}>Click</button>;
}
```

### `usePluginEvent(type, callback, options?, deps?)`

Single-event subscription with automatic cleanup on unmount.

```tsx
import { usePluginEvent } from '@gauzy/plugin-ui-react';

function MyWidget() {
  usePluginEvent('time-tracked', (event) => {
    console.log('Time tracked:', event.payload);
  });

  return <div>Listening...</div>;
}
```

### `useBridgeContext()`

Access the full bridge context (injector + any extra values passed via the `context` input).

```tsx
import { useBridgeContext } from '@gauzy/plugin-ui-react';

function MyWidget() {
  const { injector, theme } = useBridgeContext();
  return <div style={{ color: theme as string }}>Hello</div>;
}
```

---

## React Bridge API

### `ReactBridge`

Low-level class implementing `UiBridge` from `@gauzy/plugin-ui`. Use it when you need direct control over mounting/unmounting.

```ts
import { ReactBridge } from '@gauzy/plugin-ui-react';

const bridge = new ReactBridge();

const result = bridge.mount({
  component: MyReactComponent,
  props: { title: 'Hello' },
  hostElement: document.getElementById('host')!,
  injector: angularInjector
});

// Later:
result.unmount();
// Or update props:
result.updateProps?.({ title: 'Updated' });
```

### `provideReactBridge()`

Environment provider — registers `ReactBridge` in Angular DI.

```ts
import { provideReactBridge, REACT_BRIDGE } from '@gauzy/plugin-ui-react';

// In app.config.ts or AppModule providers:
provideReactBridge()

// Then inject anywhere:
const bridge = inject(REACT_BRIDGE);
```

---

## Defining React Extensions

Use `defineReactExtension()` to register a React component as a plugin extension slot contribution.

```ts
import { defineReactExtension } from '@gauzy/plugin-ui-react';
import { MyWidget } from './MyWidget';

export const myExtension = defineReactExtension({
  id: 'my-widget',
  slotId: 'dashboard-widgets',
  component: MyWidget,
  props: { title: 'My Widget' },
  order: 10
});
```

Then add it to a plugin definition:

```ts
import { defineDeclarativePlugin } from '@gauzy/plugin-ui';

export const MyPlugin = defineDeclarativePlugin('my-plugin', {
  extensions: [myExtension]
});
```

---

## Building

```bash
yarn nx build ui-react
yarn nx build ui-react --configuration=production
```

## Testing

```bash
yarn nx test ui-react
```
