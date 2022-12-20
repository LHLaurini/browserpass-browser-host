# Browserpass browser host

Browserpass browser host is a messaging host for Browserpass that runs on the browser, enabling the use of Browserpass when the [native host](https://github.com/browserpass/browserpass-native) is inaccessible, like on Chrome OS or when running the Flatpak version of the browser.

## Current status

While this project is (mostly) functional, is it still very early and still needs a lot of polish.

I worked on it for most of a weekend just before the holidays, so I won't be working on it again for a while. I intend to keep working on it eventually.

## To-do list

- [ ] Keep decrypted keys in memory while the service worker goes to sleep
- [ ] Implement syncing (right now, the button does nothing)
- [ ] Fix closing password input (this is one or two lines I forgot)
- [ ] Test multiple repos
- [ ] Improve look (maybe try to match Browserpass)
- [ ] Fix some non-fatal error messages
- [ ] Clean-up code (the communication code is the messiest)
- [ ] Investigate error Browserpass' error handling (kinda weird ATM)
- [ ] Add proper instructions

## How to use

Since this is not intended for end-users yet, this section is to be left intentionally vague.

- A [patched version](https://github.com/LHLaurini/browserpass-extension) of the Browserpass extension is required. Also, update the `extensionID` constant accordingly;
- Your password store needs to be in a HTTPS Git server;
- The extension will refuse to use unencrypted keys (for security reasons).

If you have any questions, please create a new **[discussion](https://github.com/LHLaurini/browserpass-browser-host/discussions/new?category=q-a)**.
