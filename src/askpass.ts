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

function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    let password = document.getElementById("password");
    if (password instanceof HTMLInputElement) {
        chrome.runtime.sendMessage(password.value, () => {
            if (password instanceof HTMLInputElement) {
                password.value = "";
            }
        });
    }
}

window.addEventListener("load", () => {
    document.getElementById("form")?.addEventListener("submit", handleSubmit);
});
