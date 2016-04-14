var queue = [];
var updateInd = 0;
var video = document.querySelector('video');
var mediaSource = new MediaSource();
var client = new BinaryClient('WSS://roninnode-ronipa.c9users.io/stream');

var videoURL = window.URL.createObjectURL(mediaSource);
video.src = videoURL;

function playVideo(){
    mediaSource.endOfStream();
    video.play();
}

mediaSource.addEventListener('sourceopen', initMediaSource, false);

function initMediaSource(e) {
    console.log('MediaSource opened.');
    
    var mimeType = 'video/webm; codecs=vp8';
    
    if (MediaSource.isTypeSupported(mimeType)) {
        sourceBuffer = mediaSource.addSourceBuffer(mimeType);
        sourceBuffer.mode = 'sequence'; // 'segments' will order by timestamp
        // sourceBuffer.timestampOffset = 0.033;
        
        sourceBuffer.addEventListener('updateend', function(e){});
        
    } else console.log(mimeType +' mimecodec not supported');
}

mediaSource.addEventListener('sourceclose', function(e){
    console.log("MediaSource closed.");
});

mediaSource.addEventListener('error', function(e){
    console.log("Error: " + mediaSource.readyState );
});

client.on('open', function(){
    console.log("yhdistetty");
    client.createStream({event: 'request'});
});

client.on('stream', function(stream, meta){
    // var chunks = [];
    console.log("Uusi stream");
    
    stream.on('data', function(data) {
        if (typeof data !== 'string') {
            queue.push(new Uint8Array(data));
            appendBlob(0);
            first = false;
        } else {
            console.log("Saapui tekstiä");
        }
    });
    
    stream.on('end', function(){
        stream.write({ end: true });
    });
});

function appendBlob(e) {
    if (queue.length > 0 && !sourceBuffer.updating) {
        sourceBuffer.appendBuffer(queue.shift());
        console.log('Uint8Array appended to buffer');
    }
}