    var fs, uploadPath, supportedTypes;
     
    fs = require('fs');
    uploadPath = __dirname + '/../videos';
    supportedTypes = [
        'video/webm; codecs=vp8'
    ];
     
    module.exports = {
        request : request,
        upload  : upload,
        removeClient : removeClient
    };
    
    var clientset = new Set();
    var streamerset = new Set();
    var mimeType = "";
    
    function request(client , meta) {
        //client.write(new Uint8Array(mimeType));
        
        clientset.add(client);
        console.log('Uusi BinaryClient lisätty request-listaan');
    }
    
    function upload(client, stream, meta) {
        var chunks = [];
        mimeType = meta.type;
        
        if (!streamerset.has(client))
            streamerset.add(client);
        
        if (!~supportedTypes.indexOf(meta.type)) {
            console.log("Format not supported!");
            stream.write({ err: 'Unsupported type: ' + meta.type });
            stream.end();
            return;
        }
        
        for (var c of clientset) {
            c.send(stream, meta);
        }
        
        stream.on('data', function (data) {
            console.log("Vastaanotettu dataa [type: "+meta.type+"]");
            chunks.push(data);
        });
        
        stream.on('end', function () {
            stream.write({ end: true });
            console.log("Data saapunut");
            
            fs.exists('./videos/test.webm', function(exists){
                if (!exists){
                    var fStream = fs.createWriteStream('./videos/test.webm');
                
                    for (var c of chunks)
                        fStream.write(c);
                    
                    fStream.close();

                    var exec = require('child_process').exec;
                    exec('bin/mse_webm_remuxer videos/test.webm videos/fixedExample.webm', 
                    function callback(error, stdout, stderr){
                        console.log("Video has been fixed as webm");
                    });
                    
                    chunks = [];
                }
            });
        });
    }
    
    function removeClient(client){
        if (clientset.has(client)){
            clientset.delete(client);
            console.log('BinaryClient removed from clientset');
        } else if (streamerset.has(client)){
            streamerset.delete(client);
            console.log('Streamer removed from streamerset');
        } else {
            console.log('Client not found, could not remove');
        }
    }