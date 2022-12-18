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

import LightningFS from "@isomorphic-git/lightning-fs";
import git from "isomorphic-git";
import * as pgp from "openpgp";

import type { ClonePopupMessage, WorkerMessage } from "./comm";
import { getKeys, getKeysFilePath, getReposList, nameToPath, rmdirRecursive } from "./utils";

let fs = new LightningFS("fs");

// TODO: Maybe put these somewhere else?
let nameElement: HTMLInputElement;
let urlElement: HTMLInputElement;
let userElement: HTMLInputElement;
let passwordElement: HTMLInputElement;
let pgpImportArea: HTMLElement;
let pgpKeyListing: HTMLElement;
let pgpKeysElement: HTMLTextAreaElement;
let setNewPgpKeysElement: HTMLElement;
let repoTableBody: HTMLElement;
let repoTableInsertionPoint: HTMLElement;
let messagesElement: HTMLElement;

async function doAdd(port: chrome.runtime.Port) {
    const name = nameElement.value;
    const url = urlElement.value;
    const user = userElement.value;
    const password = passwordElement.value;

    // We leave cloning to the worker, since it could take some time (even if the repo is not large,
    // network may be slow)
    const message: ClonePopupMessage = {
        type: "clone",
        name: name,
        url: url,
        user: user,
        password: password,
    };
    port.postMessage(message);
}

async function doImport() {
    const armoredInput = pgpKeysElement.value;
    let privateKeys: pgp.PrivateKey[];

    try {
        privateKeys = await pgp.readPrivateKeys({ armoredKeys: armoredInput });
    } catch (e: unknown) {
        if (e instanceof Error) {
            setStatus(e.toString());
        } else {
            setStatus("Unknown error");
        }
        return;
    }

    if (privateKeys.some(key => key.isDecrypted())) {
        setStatus("Decrypted key found. Refusing to import.");
        return;
    }

    await fs.promises.writeFile(getKeysFilePath(), armoredInput, { mode: 0o600, encoding: "utf8" });

    setStatus(`Imported ${privateKeys.length} private keys.`);

    await populateKeyListing();
    showPgpImportArea(false);
    showPgpKeyListing(true);
}

async function doSetNewKeys() {
    showPgpImportArea(true);
    showPgpKeyListing(false);
}

async function doDelete(name: string, rowElement: HTMLTableRowElement) {
    // No recursive rmdir yet: https://github.com/isomorphic-git/lightning-fs/issues/71
    await rmdirRecursive(fs, nameToPath(name));
    rowElement.remove();
}

function getElementById(elementId: string): HTMLElement {
    let element = document.getElementById(elementId);
    if (element != null) {
        return element;
    } else {
        throw Error("element does not exist");
    }
}

function addRepoToTable(name: string, url: string) {
    let nameCol = document.createElement("td");
    nameCol.textContent = name;

    let urlCol = document.createElement("td");
    urlCol.textContent = url;

    let syncButton = document.createElement("button");
    syncButton.textContent = "S";

    let syncCol = document.createElement("td");
    syncCol.appendChild(syncButton);

    let deleteButton = document.createElement("button");
    deleteButton.textContent = "D";

    let deleteCol = document.createElement("td");
    deleteCol.appendChild(deleteButton);

    let row = document.createElement("tr");
    row.appendChild(nameCol);
    row.appendChild(urlCol);
    row.appendChild(syncCol);
    row.appendChild(deleteCol);

    deleteButton.addEventListener("click", () => doDelete(name, row));

    repoTableBody.insertBefore(row, repoTableInsertionPoint);
}

async function populateRepoList() {
    for (let name of await getReposList(fs)) {
        addRepoToTable(name, await git.getConfig({
            fs: fs,
            dir: nameToPath(name),  // get full path
            path: "remote.origin.url",
        }));
    }
}

function showPgpImportArea(show: boolean) {
    if (show) {
        pgpImportArea.classList.remove("hidden");
    } else {
        pgpImportArea.classList.add("hidden");
    }
}

function showPgpKeyListing(show: boolean) {
    if (show) {
        pgpKeyListing.classList.remove("hidden");
    } else {
        pgpKeyListing.classList.add("hidden");
    }
}

async function populateKeyListing() {
    for (const el of pgpKeyListing.getElementsByTagName("details")) {
        el.remove();
    }

    const keys = await getKeys(fs);

    console.log(keys);

    for (const key of keys) {
        let detailsChildren: (HTMLElement | string)[] = [];

        for (const subkey of key.subkeys) {
            if (detailsChildren.length > 0) {
                detailsChildren.push(document.createElement("br"));
            }
            detailsChildren.push(subkey.getFingerprint());
        }

        const summaryElement = document.createElement("summary");
        summaryElement.textContent = key.getFingerprint();

        const detailsElement = document.createElement("details");
        detailsElement.appendChild(summaryElement);
        detailsElement.append(...detailsChildren);

        pgpKeyListing.insertBefore(detailsElement, setNewPgpKeysElement);
    }
}

function setStatus(text: string) {
    messagesElement.textContent = text;
}

function handleMessage(msg: any) {
    let message = msg as WorkerMessage;

    switch (message.type) {
        case "update status":
            setStatus(message.text);
            break;

        case "clone response":
            if (message.success) {
                addRepoToTable(message.name, message.url);
            }
            break;
    }
}

window.addEventListener("load", () => {
    nameElement = getElementById("name") as HTMLInputElement;
    urlElement = getElementById("url") as HTMLInputElement;
    userElement = getElementById("user") as HTMLInputElement;
    passwordElement = getElementById("password") as HTMLInputElement;

    pgpImportArea = getElementById("pgp_import_area");
    pgpKeyListing = getElementById("pgp_key_listing");
    pgpKeysElement = getElementById("pgp_keys") as HTMLTextAreaElement;
    setNewPgpKeysElement = getElementById("set_new_pgp_keys");

    repoTableBody = getElementById("repo_table_body");
    repoTableInsertionPoint = getElementById("repo_table_insertion_point");
    messagesElement = getElementById("messages");

    populateRepoList();
    populateKeyListing();
    showPgpKeyListing(true);

    messagesElement.textContent = "Connecting to background worker...";
    let port = chrome.runtime.connect();
    port.onMessage.addListener(handleMessage);

    getElementById("add").addEventListener("click", () => doAdd(port));
    getElementById("import_pgp_keys").addEventListener("click", doImport);
    setNewPgpKeysElement.addEventListener("click", doSetNewKeys);
});
