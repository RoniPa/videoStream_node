    var fs, uploadPath, supportedTypes;
    var execFile = require('child_process').execFile;
     
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
    var vInd = 0;
    
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
        
        /*
        for (var c of clientset) {
            c.send(stream, meta);
        }
        // */
        
        stream.on('data', function (data) {
            console.log("Vastaanotettu dataa [type: "+meta.type+"]");
            chunks.push(data);
        });
        
        stream.on('end', function () {
            var FILE1 = 'videos/t'+vInd+'.webm',
                FILE2 = 'videos/f'+vInd+'.webm';
                
            var meta = {
              "type": "video/webm; codecs=\"vp8\"",
              "live": true, 
              "init": { "offset": 0, "size": 264},
              "media": [
                { "offset": 264, "size": 228888, "timecode": 0.000000 }
              ]
            };
                        
            vInd++;
            
            stream.write({ end: true });
            console.log("Data saapunut");
            
            fs.exists('videos/t'+vInd+'.webm', function(exists){
                if (!exists){
                    
                    // kirjoitetaan data (väliaikais)tiedostoon
                    var fStream = fs.createWriteStream(FILE1);
                    
                    
                    
                    
                    // -- TODO: EDML headerin lisääminen toimimaan - nykyinen toteutus p*ska --//
                    
                    
                    
                    fStream.write(JSON.stringify(meta));
                    
                    for (var c of chunks) fStream.write(c);
                    chunks = [];
                    
                    // suoritetaan videomuunnos (varmistaa lähetettävän datan eheyden)
                    execFile('bin/mse_webm_remuxer', 
                    ['./'+FILE1, './'+FILE2], 
                    (error, stdout, stderr) => 
                    {
                        var file = fs.createReadStream(FILE2);
                        fs.unlink(FILE1);
                        
                        vInd++;
                        
                        file.on('open', function () {
                            for (var c of clientset) c.send(file, meta);
                            console.log("Video has been fixed as webm and sent");
                        });
                        
                        if (error !== null) {
                            console.log("ERROR: "+ error);
                        }
                    });
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