function downloadFile(uuid, name) {
    return fetch("http://localhost/alfresco/s/api/node/workspace/SpacesStore/" + uuid + "/content").then(function (response) {

        var data = response.blob();

        var fd = new FormData();

        fd.append("test", new Blob(["aaaa"], { type: "text/plain" }));

        fd.append('metadata', new Blob([JSON.stringify({
            title: name,
            mimeType: 'application/vnd.google-apps.document',
            parents: [{ id: "root" }],
        })], {
                type: "application/json"
            }));

        fd.append('upl', data, name);




        return fetch('https://www.googleapis.com/upload/drive/v3?uploadType=multipart', {
            method: 'POST',
            body: fd,
            headers: {
                //"Content-Type": "application/vnd.google-apps.document",
                //"Content-Length": data.size,
                authorization: "Bearer " + gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token,
            }
        }).then(a => a.json());

        //return response.blob();
    });
}


function createEmptyDoc(name) {
    var data = {
        name: name,
        parents: [{ id: "root" }],
    };
    return fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
            "Content-Type": "application/json",
            authorization: "Bearer " + gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token,
        }
    }).then(a => a.json());
}

function createDoc1(uuid, name) {

    return Promise.all([
        fetch("http://localhost/alfresco/s/api/node/workspace/SpacesStore/" + uuid + "/content"),
        createEmptyDoc(name)
    ]).then(response => {

        console.log(response, response[1]);
        var data = response[0].blob();
        var id = response[1].id;

        return fetch('https://www.googleapis.com/upload/drive/v3/files/' + id, {
            method: 'PATCH',
            body: data,
            headers: {
                "Content-Type": response[0].headers.get("content-type"),
                "Content-Length": data.size,
                authorization: "Bearer " + gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token,
            }
        }).then(a => a.json());
    });

}

function alfrescoToGoogleDoc (uuid, name) {
    let contentType = "application/octet-stream";
    return fetch("http://localhost/alfresco/s/api/node/workspace/SpacesStore/" + uuid + "/content").then(function (response) {
        contentType = response.headers.get("content-type");
        return response.blob();
    }).then(data => insertFile(data, name, contentType));
}




document.getElementById('test').onclick = function () {
    /*downloadFile("6eeaf391-3345-4364-8e3a-5c7517af3cd6", "AAAA.doc").then(resp => {
        console.log(resp);
        alert("uploaded");
    });*/

    //createEmptyDoc("test2.doc").then(a => console.log(a));
    //createDoc("6eeaf391-3345-4364-8e3a-5c7517af3cd6", "test2.doc").then(a => console.log(a));
    alfrescoToGoogleDoc("6eeaf391-3345-4364-8e3a-5c7517af3cd6", "test3.doc").then(result => console.log(result));

};

function updateAlfDoc (uuid, data, contentType) {
    return new Promise((resolve, reject) => {
        var reader = new window.FileReader();
        reader.readAsBinaryString(data);
        reader.onloadend = function () {
            fetch("http://localhost/alfresco/api/-default-/public/cmis/versions/1.1/atom/content?id=" + uuid, {
                method: "PUT",
                body: reader.result,
                headers: {
                    "Content-Type": contentType || "application/vnd.google-apps.document"
                }
            }).then(resolve);
        }
    });
}



function updateAlfDoc3 (uuid, data, contentType) {
    var data = new FormData();
    data.append("filedata", new File([data], 'name.docx'), 'name.docx');
    data.append("updateNodeRef", "workspace://SpacesStore/" + uuid);
    data.append("contenttype", contentType);
    
    return fetch("http://localhost/alfresco/s/api/upload", {
        method: "POST",
        body: data,
    });
}

/**
 * Print files.
 */
function listFiles () {
    
    fetch("https://www.googleapis.com/drive/v3/files", { headers: { authorization: "Bearer " + gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token } }).then(a => a.json()).then(a => console.log(a));

    console.log("listFiles");
    gapi.client.drive.files.list({
        'pageSize': 40,
        'fields': "nextPageToken, files(id, name)"
    }).then(function (response) {
        appendPre('Files:');
        var files = response.result.files;
        if (files && files.length > 0) {
            for (var i = 0; i < files.length; i++) {
                var file = files[i];
                appendPre(file.name + ' (' + file.id + ')');
            }
        } else {
            appendPre('No files found.');
        }
    });
}
    

/**
 * Append a pre element to the body containing the given message
 * as its text node. Used to display the results of the API call.
 *
 * @param {string} message Text to be placed in pre element.
 */
function appendPre (message) {
    var pre = document.getElementById('content');
    var textContent = document.createTextNode(message + '\n');
    pre.appendChild(textContent);
}
    