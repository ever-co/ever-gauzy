# Ever Gauzy Server Application

Ever Gauzy Server is a cross-platform application built with [nstudio/electron](https://github.com/nstudio/xplat).

---

## Prerequisites

- [Node.js](https://nodejs.org/) (version 20 or later recommended)
- [Yarn](https://yarnpkg.com/) (Package Manager)
- [nstudio/electron](https://github.com/nstudio/xplat)
---

## How to:

-   install dependencies & bootstrap solution

```bash

yarn bootstrap

```

**build executable for mac**

build desktop

```bash
yarn build:desktop
```

build execute app

```bash
build:desktop:mac:quick
```

**build execute app for windows**

build desktop

```bash
yarn build:desktop
```

build execute app

```bash
build:desktop:windows:quick
```

uninstall gauzy desktop macOS

```bash
- delete app data
$ rm -rf ~/Library/Application Support/gauzy-server
```
