

// Client ID and API key from the Developer Console
var CLIENT_ID = '198651738822-maq3faggfktaa6ddeaerr7gmms8n4hoj.apps.googleusercontent.com';

// Array of API discovery doc URLs for APIs used by the quickstart
var DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];

// Authorization scopes required by the API; multiple scopes can be included, separated by spaces.
var SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata';

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
        discoveryDocs: DISCOVERY_DOCS,
        clientId: CLIENT_ID,
        scope: SCOPES
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
        //listFiles();
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

/**
 * Append a pre element to the body containing the given message
 * as its text node. Used to display the results of the API call.
 *
 * @param {string} message Text to be placed in pre element.
 */
function appendPre(message) {
    var pre = document.getElementById('content');
    var textContent = document.createTextNode(message + '\n');
    pre.appendChild(textContent);
}



function alfrescoToGoogleDoc (uuid, name) {
    let contentType = "application/octet-stream";
    return fetch("http://localhost/alfresco/s/api/node/workspace/SpacesStore/" + uuid + "/content").then(function (response) {
        contentType = response.headers.get("content-type");
        window.contentType = contentType;
        return response.blob();
    }).then(data => insertFile(data, name, contentType));
}

window.uuid = "a690a790-308d-4433-a531-724fdb0741b6";

document.getElementById('edit').onclick = function () {
    alfrescoToGoogleDoc(window.uuid, "test3.doc").then(result => {
        //console.log(result);
        openInNewTab("https://docs.google.com/document/d/" + result.id + "/edit")
        //openInNewTab("https://drive.google.com/file/d/" + result.id + "/view?usp=drivesdk")

        window.gdId = result.id;

        /*
        var request = gapi.client.drive.files.get({
            fileId: result.id
        });
        request.execute(function(resp) {
            console.log("----------------");
            console.log(resp);
        });
        */
    });
};

document.getElementById('save').onclick = function () {
    //var targetMimetype = window.contentType;
    var targetMimetype = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    googleDocContent(window.gdId, targetMimetype).then(data => alfrescoUploadContent(window.uuid, data, targetMimetype)).then(() => console.log("ok"));

    /*
    fetch("http://localhost/alfresco/s/api/node/workspace/SpacesStore/" + window.uuid + "/content").then(function (response) {
        return response.blob();
    }).then(data => {
        return updateAlfDoc2 (window.uuid, data, targetMimetype);
    }).then(a => console.log("ok"));
    */
};


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
function insertFile(data, name, contentType) {
    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

    var metadata = {
        title: name,
        name: name,
        mimeType: contentType,
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
                params: { 'uploadType': 'multipart', 'convert': true },
                headers: {
                    'Content-Type': 'multipart/mixed; boundary="' + boundary + '"'
                },
                body: multipartRequestBody
            });
            const callback = function (result) {
                resolve(result);
            };
            request.execute(callback);
        }
    });
}

function openInNewTab(url) {
    var win = window.open(url, '_blank');
    win.focus();
}

function googleDocContent (id, mimeType) {
    return fetch("https://www.googleapis.com/drive/v3/files/" + id + "/export?mimeType=" + encodeURIComponent(mimeType), {
        headers: {
            authorization: "Bearer " + gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token,
        }
    }).then(function (response) {
        return response.blob();
    });
}



function alfrescoUploadContent (uuid, data, contentType) {
    return new Promise((resolve, reject) => {
        var reader = new window.FileReader();
        reader.readAsArrayBuffer(data);
        reader.onloadend = function () {

            var data = new FormData();
            data.append("filedata", new File([reader.result], 'name.docx'), 'name.docx');
            data.append("updateNodeRef", "workspace://SpacesStore/" + uuid);
            data.append("contenttype", contentType);
            
            return fetch("http://localhost/alfresco/s/api/upload", {
                method: "POST",
                body: data,
            }).then(resolve);
        };
    });
}
    