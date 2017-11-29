
const GDRIVE_CONFIG = {
    // Client ID and API key from the Developer Console
    CLIENT_ID: '198651738822-maq3faggfktaa6ddeaerr7gmms8n4hoj.apps.googleusercontent.com',
    // Array of API discovery doc URLs for APIs used by the quickstart
    DISCOVERY_DOCS: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
    // Authorization scopes required by the API; multiple scopes can be included, separated by spaces.
    SCOPES: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata',
}

var authorizeButton = document.getElementById('authorize-button');
var signoutButton = document.getElementById('signout-button');

/**
 *  On load, called to load the auth2 library and API client library.
 */
function handleClientLoad() {
    gapi.load('client:auth2', initClient);
}

/**
 *  Initializes the API client library and sets up sign-in state
 *  listeners.
 */
function initClient() {
    console.log("init");
    gapi.client.init({
        discoveryDocs: GDRIVE_CONFIG.DISCOVERY_DOCS,
        clientId: GDRIVE_CONFIG.CLIENT_ID,
        scope: GDRIVE_CONFIG.SCOPES
    }).then(function () {
        console.log("init callback");
        // Listen for sign-in state changes.
        gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);

        // Handle the initial sign-in state.
        updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
        authorizeButton.onclick = handleAuthClick;
        signoutButton.onclick = handleSignoutClick;
    });
}

/**
 *  Called when the signed in status changes, to update the UI
 *  appropriately. After a sign-in, the API is called.
 */
function updateSigninStatus(isSignedIn) {

    if (isSignedIn) {
        console.log("Bearer token: ", gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().id_token);
        authorizeButton.style.display = 'none';
        signoutButton.style.display = 'block';
    } else {
        authorizeButton.style.display = 'block';
        signoutButton.style.display = 'none';
    }
}

/**
 *  Sign in the user upon button click.
 */
function handleAuthClick(event) {
    gapi.auth2.getAuthInstance().signIn();
}

/**
 *  Sign out the user upon button click.
 */
function handleSignoutClick(event) {
    gapi.auth2.getAuthInstance().signOut();
}


class GoogleDrive {

    /**
     * Creates a folder or get the existing folder if already exists.
     * 
     * @param {*} name of the folder
     * @param {*} folderParentId  where to create the new folder
     */
    createOrGetFolder (name, folderParentId = "root") {
        const mimeType = "application/vnd.google-apps.folder";
        const q = "name='" + name + "' and mimeType='" + mimeType + "' and parents in 'root' and trashed = false";
        const url = "https://www.googleapis.com/drive/v3/files?q=" + encodeURIComponent(q);

        return new Promise((resolve, reject) => {
            fetch(url, {
                headers: {
                    authorization: "Bearer " + gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token,
                }
            }).then(a => a.json()).then(r => {
                if (r.files.length > 0) {
                    resolve(r.files[0].id);
                } else {
                    const request = gapi.client.request({
                        path: '/drive/v3/files',
                        method: 'POST',
                        body: JSON.stringify({name: name, mimeType: mimeType, parents: [{id: folderParentId}]})
                    });
                    request.execute(resp => resolve(resp.id));
                }
            });
        });
    }


    /**
     * Insert new file in google drive.
     *
     * @param {Blob} data content of the file.
     * @param {String} name name of the file.
     * @param {String} contentType type of content.
     * @param {Function} callback Function to call when the request is complete.
     * 
     * @returns Promise with result
     */
    createDoc (data, name, contentType, parentFolderId = "root") {

        const boundary = '-------314159265358979323846';
        const delimiter = "\r\n--" + boundary + "\r\n";
        const close_delim = "\r\n--" + boundary + "--";

        var metadata = {
            title: name,
            name: name,
            mimeType: contentType,
            parents: [{id: parentFolderId}],
            //convert: "application/vnd.google-apps.document",
        };

        return new Promise((resolve, reject) => {
            var reader = new window.FileReader();
            reader.readAsBinaryString(data);
            reader.onloadend = function () {
                const base64data = btoa(reader.result);

                const multipartRequestBody =
                    delimiter +
                    'Content-Type: application/json\r\n\r\n' +
                    JSON.stringify(metadata) +
                    delimiter +
                    'Content-Type: ' + contentType + '\r\n' +
                    'Content-Transfer-Encoding: base64\r\n' +
                    '\r\n' +
                    base64data +
                    close_delim;

                const request = gapi.client.request({
                    path: '/upload/drive/v2/files',   // v2 contains the "convert" options (missing in V3, replaced by https://developers.google.com/drive/v3/web/migration)
                    //path: '/upload/drive/v3/files',
                    method: 'POST',
                    params: { uploadType: 'multipart', convert: true /* !! allows to convert the doc to native gdrive type */ },
                    headers: {
                        'Content-Type': 'multipart/mixed; boundary="' + boundary + '"'
                    },
                    body: multipartRequestBody
                });
                const callback = function (result) {
                    resolve(result.id);
                };
                request.execute(callback);
            }
        });
    }

    getContent (id, requestedMimeType) {
        return fetch("https://www.googleapis.com/drive/v3/files/" + id + "/export?mimeType=" + encodeURIComponent(requestedMimeType), {
            headers: {
                authorization: "Bearer " + gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token,
            }
        }).then(function (response) {
            return response.blob();
        });
    }
    

    deleteDoc (id) {
        return fetch("https://www.googleapis.com/drive/v3/files/" + id, {
            method: "DELETE",
            headers: {
                authorization: "Bearer " + gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token,
            },
        });
    }
}



class Alfresco {

    constructor (baseUrl = "http://localhost/alfresco/s") {
        this.baseUrl = baseUrl;
    }

    getContent (uuid) {
        let contentType = "application/octet-stream";
        return fetch(this.baseUrl + "/api/node/workspace/SpacesStore/" + uuid + "/content").then(function (response) {
            contentType = response.headers.get("content-type");
            return response.blob();
        }).then(data => ([data, contentType]));
    }

    updateContent (uuid, data, contentType) {
        const self = this;
        return new Promise((resolve, reject) => {
            var reader = new window.FileReader();
            reader.readAsArrayBuffer(data);
            reader.onloadend = function () {
                var data = new FormData();
                data.append("filedata", new File([reader.result], 'name.docx'), 'name.docx');
                data.append("updateNodeRef", "workspace://SpacesStore/" + uuid);
                data.append("contenttype", contentType);
                
                fetch(self.baseUrl + "/api/upload", {
                    method: "POST",
                    body: data,
                }).then(resolve).catch(reject);
            };
        });
    }

    /**
     * Update the content of an existing alfresco document (using APIX).
     * 
     * @param {*} uuid 
     * @param {*} data 
     * @param {*} contentType 
     */
    updateContent_OLD2 (uuid, data, contentType) {
        const self = this;
        return new Promise((resolve, reject) => {
            var reader = new window.FileReader();
            reader.readAsArrayBuffer(data);
            reader.onloadend = function () {
                var data = new FormData();
                data.append("file", new File([reader.result], 'name.docx'));
                fetch(self.baseUrl + "/apix/v1/nodes/workspace/SpacesStore/" + uuid + "/content", {
                    method: "PUT",
                    headers: {
                        "Content-Type": "multipart/form-data",
                    },
                    body: data,
                }).then(resolve).catch(reject);
            };
        });
    }


    updateContent_OLD3 (uuid, data, contentType) {
        return new Promise((resolve, reject) => {
            var reader = new window.FileReader();
            reader.readAsBinaryString(data);
            reader.onloadend = function () {
                fetch("http://localhost/alfresco/api/-default-/public/cmis/versions/1.1/atom/content?id=" + uuid, {
                    method: "PUT",
                    body: reader.result,
                    headers: {
                        "Content-Type": contentType || "application/vnd.google-apps.document",
                        "Content-Length": reader.result.length,
                    }
                }).then(resolve).catch(reject);
            }
        });
    }

}


(function () {

    const GDRIVE_ROOT_FOLDER_NAME = "ALFRED-FINDER-DOCS";

    const alfresco = new Alfresco("http://localhost/alfresco/s");
    const gdrive = new GoogleDrive(); 

    const uuid = "c73cc4b1-263e-432a-a689-d8a7f7119ad5";
    let gdocId = "";

    document.getElementById('edit').onclick = function () {

        const all = Promise.all([ alfresco.getContent(uuid),  gdrive.createOrGetFolder("ALFRED-FINDER-DOCS")  ]);

        all.then(([[data, contentType], folderId]) => gdrive.createDoc(data, uuid, contentType, folderId)).then(id => { 
            gdocId = id;
            openInNewTab("https://docs.google.com/document/d/" + id + "/edit")    
            //openInNewTab("https://drive.google.com/file/d/" + id + "/view?usp=drivesdk")
        });
    };

    document.getElementById('save').onclick = function () {
        var targetMimetype = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        gdrive.getContent(gdocId, targetMimetype).then(data => alfresco.updateContent(uuid, data, targetMimetype)).then(() => gdrive.deleteDoc(gdocId) ).then(() => console.log("ok"));
        };


    document.getElementById('test').onclick = function () {
        const contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        alfresco.getContent(uuid).then(result => {
            console.log("aaaa");
            alfresco.updateContent(uuid, result[0], contentType).then(() => console.log("uploaded!")).catch(() => console.log("error!"));
        });
    };

    document.getElementById('test2').onclick = function () {
        gdrive.createOrGetFolder("TEST1").then(id => console.log("id: " + id));
    };

})();




function openInNewTab(url) {
    var win = window.open(url, '_blank');
    win.focus();
}



