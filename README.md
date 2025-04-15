# Sensitive Data Masker

_Copyright 2025 Caleb Evans_  
_Released under the MIT license_

Sensitive Data Masker is a Chrome extension that masks the values of sensitive information like currency values, passwords, and credit card numbers.

## Developer Setup

### Build project

Once you've cloned the project, you must install dependencies and build the
extension using your preferred package manager (like npm, yarn, or pnpm):

```sh
pnpm install
pnpm build
```

### Install from Chrome

Once the extension is built, open [chrome://extensions](chrome://extensions) and
enable **Developer mode** in the top-right corner.

Once you see the Developer Mode toolbar appear, click the "Load unpacked"
button, then choose the `dist/` directory in the repository.
