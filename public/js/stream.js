var R_BLOB_LENGTH = 2000,
    CONNECTED = false,
    MIME_TYPE = 'video/webm; codecs=vp8';
    
var curStream, recorder;
var video = document.querySelector('video');

function hasGetUserMedia() {
    if (navigator.mediaDevices.getUserMedia) return 1;
    else if (navigator.webkitGetUserMedia) return 2;
    else return false;
}

function streamaa(localMediaStream){
    curStream = localMediaStream;
    recorder = new MediaRecorder(curStream, {mimeType:MIME_TYPE});
    
    video.src = window.URL.createObjectURL(curStream);
    
    // Connect stream
    video.onloadedmetadata = function(e){
        // /*
        client = new BinaryClient('WSS://roninnode-ronipa.c9users.io/stream');
        
        recorder.start(R_BLOB_LENGTH);
        
        // Send data to server when available
        recorder.ondataavailable = function(e){
            if (CONNECTED) {
                // Lähetetään data Blob-elementtinä
                client.send(e.data, {event:'upload', type:recorder.mimeType});
                console.log("Lähetetty dataa, "+ this.result);
            }
        };
        
        client.on('open', function(){
            CONNECTED = true;
        });
    }
}

var userMed = hasGetUserMedia();
if (userMed === 1) {
    navigator.mediaDevices.getUserMedia({
        video: {
            // width: { min: 640, ideal: 1280, max: 1920 },
            // height: { min: 360, ideal: 1280, max: 1920 },
            width: { max: 160 },
            height: { max: 120 }
            // facingMode: "user"
        }, 
        audio:false })
    .then(function(s){streamaa(s)})
    .catch(function err(e){alert(e.name +': '+ e.message)});
} else if (userMed === 2){
    navigator.webkitGetUserMedia({
            video: {
                width: { max: 160 },
                height: { max: 120 }
            },
            audio:false 
        },
        function(s){streamaa(s)},
        function err(e){alert(e.name +': '+ e.message)});
} else {
    alert('getUserMedia() is not supported in your browser');
}