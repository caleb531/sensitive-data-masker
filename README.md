# Sensitive Data Masker

_Copyright 2025 Caleb Evans_  
_Released under the MIT license_

Sensitive Data Masker is a Chrome extension that masks the values of sensitive
information like monetary amounts, social security numbers, and other sensitive
values. This is useful if you want to show someone a webpage without revealing
the sensitive information on it.

[Install from the Chrome Web Store][web-store]

[web-store]: https://chromewebstore.google.com/detail/jknjckjoianbkgfpjifjebfjgnfdpmgb

## How to use

1. **Add the extension to Chrome**  
   After installing the extension, the icon will be added to the Chrome
   Extensions menu (puzzle piece icon in the toolbar). To make it easier to
   access, you can pin the icon:

   - Click the Extensions menu (puzzle piece icon) in the Chrome toolbar.
   - Find "Sensitive Data Masker" in the list and click the pin icon next to it.

2. **Open the Options page**  
   Click the extension icon in the toolbar (or from the Extensions menu) to open
   the options page.

3. **Add websites to the allowed list**  
   On the Options page, you can manage the list of websites where sensitive data
   masking will be applied:

   - Click **"Add new website"** to add a blank entry. You can then type the
     hostname or URL of the website you want to allow; wildcards (`*`) are
     supported (e.g. `*.mywebsite.com`)
   - Click **"Add current"** to quickly add the website under the active tab.
   - Click **"Allow site access"** and approve the Chrome prompt. The row shows
     the domain that Chrome will grant access to. Masking follows the saved rule,
     including any URL path or wildcard you entered.

   You can also add a website to the allowed list by right-clicking the webpage,
   choosing "Sensitive Data Masker" from the menu, and then clicking "Add
   Current".

4. **Enable or disable masking for specific websites**  
   Use the toggle switch next to each website in the list to enable or disable
   masking for that website while keeping its approval. Use **"Revoke access"**
   to withdraw Chrome's permission and keep the rule. Revoking a shared grant
   affects every rule it covers.

5. **Edit or remove websites**

   - To edit a website, click the input field and update the hostname or URL
     pattern.
   - To remove a website, click the X icon next to it. The extension releases
     its site permission if no other saved rule uses it.

6. **Changes are autosaved**  
   Website edits are saved when you leave the field or press Enter. Reload an
   already-open page to apply changes there.

7. **Disable masking temporarily**  
   If you want to temporarily disable masking for all websites, you can toggle
   the extension off from the Chrome toolbar by clicking the extension icon and
   using the provided controls.

8. **Toggle visibility of certain data types**: At the top of the extension
   popup, you will see a list of the various data types that can be
   automatically masked by the extension. Toggling the switch for any data type
   will change whether it is currently masked (enabled means values will be
   masked, whereas disabled means those values will be visible).

<img src="screenshot-page.png" alt="Sensitive Data Masker Example Page" style="width: 480px; max-width: 100%;">

<img src="screenshot-options.png" alt="Sensitive Data Masker Options" style="width: 480px; max-width: 100%;">

## Upgrading to 2.0

Your saved rules and masking settings carry over from 1.x. Approve site access
for your saved rules to resume automatic masking. Chrome keeps approvals in the
current browser profile, so another profile needs its own approval even if your
rules sync there. Version 2.0 supports site access for HTTP and HTTPS pages.

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
