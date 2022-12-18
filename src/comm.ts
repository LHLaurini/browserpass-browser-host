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

// Messages from the worker (to the popup)
export type UpdateStatusWorkerMessage = {
    type: "update status",
    text: string,
};
export type SuccessfulCloneResponseWorkerMessage = {
    type: "clone response",
    success: true,
    name: string,
    url: string,
};
export type UnsuccessfulCloneResponseWorkerMessage = {
    type: "clone response",
    success: false,
};
export type CloneResponseWorkerMessage =
    SuccessfulCloneResponseWorkerMessage |
    UnsuccessfulCloneResponseWorkerMessage;
export type ResponseWorkerMessage = CloneResponseWorkerMessage;
export type WorkerMessage = UpdateStatusWorkerMessage | ResponseWorkerMessage;

// Messages from the popup (to the worker)
export type ClonePopupMessage = {
    type: "clone",
    name: string,
    url: string,
    user: string,
    password: string,
};
export type PopupMessage = ClonePopupMessage;

// External messages (to the worker)
export type SettingsObject = {
    stores: {
        [id: string]: {
            id: string,
            name: string,
            path: string,
        },
    },
};
export type ConfigureMessage = {
    action: "configure",
    settings: SettingsObject,
};
export type ListMessage = {
    action: "list",
    settings: SettingsObject,
};
export type FetchMessage = {
    action: "fetch",
    settings: SettingsObject,
    storeId: string,
    file: string,
};
export type EchoMessage = {
    action: "echo",
    echoResponse: any,
};
export type UnknownMessage = {
    action: "A dummy string that we'd never receive",
};
export type ExternalMessage = ConfigureMessage | ListMessage | FetchMessage | EchoMessage | UnknownMessage;

// External message responses (from the worker)
export type ConfigureExternalMessageResponseData = {
    defaultStore: {
        path: string,
        settings: string,
    }, storeSettings: {
        [storeId: string]: string,
    },
};
export type ListExternalMessageResponseData = {
    files: {
        [storeId: string]: string[],
    },
};
export type FetchExternalMessageResponseData = {
    contents: string,
};
export type ExternalMessageResponseData =
    ConfigureExternalMessageResponseData |
    ListExternalMessageResponseData |
    FetchExternalMessageResponseData;
export type OkExternalMessageResponse = {
    status: "ok",
    version: number,
    data: ExternalMessageResponseData | undefined,
};
export type ErrorCode = number;
export type ErrorExternalMessageResponse = {
    status: "error",
    code: ErrorCode,
    version: number,
    params: {
        [param: string]: any,
    },
};
export type ExternalMessageResponse = OkExternalMessageResponse | ErrorExternalMessageResponse;
