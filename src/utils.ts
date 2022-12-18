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
import Path from "@isomorphic-git/lightning-fs/src/path";
import * as pgp from "openpgp";

export function getReposDir(): string {
    return "/repos";
}

export async function getReposList(fs: LightningFS): Promise<string[]> {
    try {
        return (await fs.promises.readdir(getReposDir())).map(x => pathToName(x)).sort();
    } catch {
        return [];
    }
}

export function nameToPath(name: string): string {
    return Path.join(getReposDir(), encode(name));
}

export function encode(str: string): string {
    // path-safe base64
    return btoa(str).replace(/\+/g, "-").replace(/\//g, "_");
}

export function decode(str: string): string {
    // path-safe base64
    return atob(str.replace(/-/g, "+").replace(/_/g, "/"));
}

export function pathToName(name: string): string {
    return decode(Path.basename(name));
}

export async function rmdirRecursive(fs: LightningFS, path: string) {
    for (let entry of await fs.promises.readdir(path)) {
        const subpath = Path.join(path, entry);
        if ((await fs.promises.lstat(subpath)).isDirectory()) {
            await rmdirRecursive(fs, subpath);
        } else {
            await fs.promises.unlink(subpath);
        }
    }
    await fs.promises.rmdir(path);
}

export async function readdirRecursive(fs: LightningFS, path: string): Promise<string[]> {
    let result: string[] = [];
    for (let entry of await fs.promises.readdir(path)) {
        const subpath = Path.join(path, entry);
        if ((await fs.promises.lstat(subpath)).isDirectory()) {
            result = result.concat(await readdirRecursive(fs, subpath));
        } else {
            result.push(subpath);
        }
    }
    return result;
}

export function getKeysFilePath() {
    return "/pgp_keys";
}

export async function getKeys(fs: LightningFS): Promise<pgp.PrivateKey[]> {
    let keys: string | Uint8Array;
    try {
        keys = await fs.promises.readFile(getKeysFilePath(), { encoding: "utf8" });
    } catch {
        return [];
    }
    if (typeof keys != "string") {
        throw Error("unexpected");
    }
    return await pgp.readPrivateKeys({ armoredKeys: keys });
}
