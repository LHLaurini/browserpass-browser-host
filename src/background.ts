/*
Copyright (C) 2022 Luiz Henrique Laurini.

This file is part of Browserpass browser host.

Browserpass browser host is free software: you can redistribute it and/or modify it under the terms
of the GNU General Public License as published by the Free Software Foundation, either version 3 of
the License, or (at your option) any later version.

Browserpass browser host is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with Browserpass browser
host. If not, see <https://www.gnu.org/licenses/>.
*/

import type { ResponseWorkerMessage, PopupMessage, WorkerMessage, ExternalMessageResponse, ErrorExternalMessageResponse, ExternalMessage } from "./comm";
import LightningFS from "@isomorphic-git/lightning-fs";
import git, { GitAuth, GitProgressEvent } from "isomorphic-git";
import http from "isomorphic-git/http/web";
import { getKeys, getReposList, nameToPath, pathToName, readdirRecursive } from "./utils";
import * as pgp from "openpgp";
import Path from "@isomorphic-git/lightning-fs/src/path";

const MAX_TRIES = 5;
const VERSION = 3007002;

let fs = new LightningFS("fs");
let keyCache: { [fingerprint: string]: pgp.PrivateKey } = {};

function sendResponseToPopup(port: chrome.runtime.Port, response: ResponseWorkerMessage) {
    port.postMessage(response);
}

function updateStatus(port: chrome.runtime.Port, text: string) {
    let ready: WorkerMessage = { type: "update status", text: text, };
    port.postMessage(ready);
}

async function handlePopupMessage(msg: any, port: chrome.runtime.Port) {
    const message = msg as PopupMessage;

    switch (message.type) {
        case "clone":
            try {
                updateStatus(port, "Cloning...");
                await git.clone({
                    fs: fs,
                    http: http,
                    dir: nameToPath(message.name),
                    url: message.url,
                    onAuth: (): GitAuth => {
                        return { username: message.user, password: message.password, };
                    },
                });
                updateStatus(port, "Done");
                sendResponseToPopup(port, { type: "clone response", success: true, name: message.name, url: message.url });
            } catch (e) {
                updateStatus(port, "Failed to clone: " + e.toString());
                sendResponseToPopup(port, { type: "clone response", success: false });
            }
            break;
    }
}

async function findKeyForRepo(repoName: string, privateKeys: pgp.PrivateKey[]): Promise<pgp.PrivateKey | null> {
    const privateKeysAndSubkeys = privateKeys.flatMap(key => [key, ...key.subkeys]);

    const gpgIdPath = Path.join(nameToPath(repoName), ".gpg-id");
    const gpgIds = await fs.promises.readFile(gpgIdPath, { encoding: "utf8" });

    if (typeof (gpgIds) != "string") {
        throw Error("unexpected");
    }

    for (const gpgId of gpgIds.split("\n")) {
        if (gpgId.length > 0) {
            const gpgIdLower = gpgId.toLowerCase();
            const keyOrSubkey = privateKeysAndSubkeys.find(x => x.getFingerprint() == gpgIdLower);
            if (keyOrSubkey instanceof pgp.PrivateKey) {
                return keyOrSubkey;
            } else if (keyOrSubkey instanceof pgp.Subkey) {
                const keyFingerprint = keyOrSubkey.mainKey.getFingerprint();
                const privateKey = privateKeys.find(key => key.getFingerprint());
                if (privateKey == undefined) {
                    throw Error("unexpected");
                }
                return privateKey;
            }
        }
    }

    return null;
}

async function decryptKey(privateKey: pgp.PrivateKey, askPass: (tryPassword: (password: string) => Promise<pgp.PrivateKey | null>) => Promise<pgp.PrivateKey | null>): Promise<pgp.PrivateKey | null> {
    const fingerprint = privateKey.getFingerprint();
    if (fingerprint in keyCache) {
        return keyCache[fingerprint];
    } else {
        return askPass(async password => {
            let decrypted: pgp.PrivateKey;

            try {
                decrypted = await pgp.decryptKey({ privateKey: privateKey, passphrase: password });
            } catch {
                return null;
            }

            keyCache[fingerprint] = decrypted;
            return decrypted;
        });
    }
}

async function askPass(tryPassword: (password: string) => Promise<pgp.PrivateKey | null>) {
    const askpassWindow = await chrome.windows.create({
        focused: true,
        type: "popup",
        url: "askpass.html",
        width: 400,
        height: 100,
    });

    const closeWindow = async () => {
        if (askpassWindow.id != null) {
            await chrome.windows.remove(askpassWindow.id);
        }
    };

    const callbackPromise = new Promise<pgp.PrivateKey | null>((acceptKey, reject) => {
        let numTries = 0;

        chrome.runtime.onMessage.addListener(async (message, _, signalFailure) => {
            if (typeof message == "string") {
                const result = await tryPassword(message);
                if (result != null) {
                    closeWindow();
                    acceptKey(result);
                }
                if (++numTries >= MAX_TRIES) {
                    closeWindow();
                    acceptKey(null);
                } else {
                    setTimeout(() => signalFailure(), 1000);
                }
            } else if (message == null) {
                acceptKey(null);
            } else {
                reject(Error("unexpected"));
            }
        });
    });

    return await callbackPromise;
}

chrome.runtime.onConnect.addListener(
    (port) => {
        port.onMessage.addListener(handlePopupMessage);
        updateStatus(port, "Ready");
    }
)

chrome.runtime.onMessageExternal.addListener(
    async (msg: any, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void): Promise<void> => {

        const message = msg as ExternalMessage;

        console.log(`Received message: ${JSON.stringify(message)}`);

        let response: ExternalMessageResponse = { status: "ok", version: VERSION, data: undefined };
        let errorResponse: ErrorExternalMessageResponse = { status: "error", version: VERSION, code: 0, params: {} };

        const repos = await getReposList(fs);
        let defaultRepo: string;
        if (repos.length > 0) {
            defaultRepo = repos[0];
        } else {
            errorResponse.code = 14;
            errorResponse.params.message = "No repos configured";
            errorResponse.params.action = message.action;
            sendResponse(errorResponse);
            return;
        }

        switch (message.action) {
            case "configure":
                response.data = {
                    defaultStore: {
                        path: defaultRepo,
                        settings: "{}",
                    },
                    storeSettings: {
                        default: "{}",
                    }
                };
                break;

            case "list":
                response.data = { files: {} };

                for (const storeId in message.settings.stores) {
                    const store = message.settings.stores[storeId];
                    console.log(store.path);
                    console.log(repos);
                    if (!repos.includes(store.path)) {
                        errorResponse.code = 13;
                        errorResponse.params.message = `Store ${store.path} does not exist`;
                        errorResponse.params.action = message.action;
                        errorResponse.params.storeId = store.id;
                        errorResponse.params.storePath = store.path;
                        errorResponse.params.storeName = store.name;
                        break;
                    }

                    response.data.files[storeId] = (await readdirRecursive(fs, nameToPath(store.path))).filter(x => x.endsWith(".gpg"));
                }
                break;

            case "fetch":
                const privateKeys = await getKeys(fs);
                const name = message.settings.stores[message.storeId].path;
                const label = message.settings.stores[message.storeId].name;
                const key = await findKeyForRepo(name, privateKeys);

                if (key == null) {
                    errorResponse.code = 24;
                    errorResponse.params.message = "No matching key found";
                    errorResponse.params.action = message.action;
                    errorResponse.params.storeId = message.storeId;
                    errorResponse.params.storePath = name;
                    errorResponse.params.storeName = label;
                    errorResponse.params.file = message.file;
                    break;
                }

                const decryptedKey = await decryptKey(key, askPass);

                if (decryptedKey == null) {
                    errorResponse.code = 24;
                    errorResponse.params.message = "Decryption failed";
                    errorResponse.params.action = message.action;
                    errorResponse.params.storeId = message.storeId;
                    errorResponse.params.storePath = name;
                    errorResponse.params.storeName = label;
                    errorResponse.params.file = message.file;
                    break;
                }

                const passwordFileData = await fs.promises.readFile(message.file);
                if (!(passwordFileData instanceof Uint8Array)) {
                    throw Error("unexpected");
                }

                const decryptedData = await pgp.decrypt({
                    message: await pgp.readMessage({
                        binaryMessage: passwordFileData,
                    }),
                    decryptionKeys: decryptedKey,
                });

                if (typeof decryptedData.data != "string") {
                    throw Error("unexpected");
                }

                response.data = { contents: decryptedData.data };

                break;

            case "echo":
                sendResponse(message.echoResponse);
                return;

            default:
                errorResponse.code = 12;
                errorResponse.params.message = `Unknown message action received: ${message.action}`;
                errorResponse.params.action = message.action;
        }

        if (errorResponse.code == 0) {
            sendResponse(response);
        } else {
            sendResponse(errorResponse);
        }
    }
);
