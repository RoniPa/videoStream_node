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
    var chunks = [];
    var vInd = 0;
    
    function request(client , meta) {
        // Add client to set
        clientset.add(client);
        console.log('Uusi BinaryClient lisätty request-listaan');
    }
    
    function upload(client, stream, meta) {
        mimeType = meta.type;
        
        // Add streamer to set
        if (!streamerset.has(client))
            streamerset.add(client);
        
        // Check mime support
        if (!~supportedTypes.indexOf(meta.type)) {
            console.log("Format not supported!");
            stream.write({ err: 'Unsupported type: ' + meta.type });
            stream.end();
            return;
        }
        
        // Send stream to clients
        for (var c of clientset) {
            c.send(stream, meta);
        }
        
        // Store data in memory
        stream.on('data', function (data) {
            console.log("Vastaanotettu dataa [type: "+meta.type+"]");
            chunks.push(data);
            
            // After 30 chunks write to file    
            if (chunks.length > 10)
                writeStreamToFile();
        });
        
        stream.on('end', function () {
            stream.write({ end: true });
            console.log("Data saapunut");
        });
    }
    
    function removeClient(client){
        if (clientset.has(client)){
            clientset.delete(client);
            console.log('BinaryClient removed from clientset');
        } else if (streamerset.has(client)){
            streamerset.delete(client);
            writeStreamToFile();
            finalizeFile();
            console.log('Streamer removed from streamerset');
        } else {
            console.log('Client not found, could not remove');
        }
    }
    
    function writeStreamToFile(){
        var FILE1 = 'videos/t'+vInd+'.webm';
        var fStream = fs.createWriteStream(FILE1);
        
        vInd++;
        
        for (var c of chunks)
            fStream.write(c);
        
        chunks = [];
    }
    
    // Append all videofiles to a single file
    function finalizeFile(){
        if (vInd > 0) {
            finalLoop();
        }
        
        function finalLoop(){
            vInd--;
            if (vInd > 0) {
                var fileurl = 'videos/t'+vInd+'.webm';
                fs.appendFile('videos/t0.webm', fileurl, finalLoop);
                fs.unlink(fileurl);
            } else {
                execFile('bin/mse_webm_remuxer',
                ['videos/t0.webm', 'videos/final.webm'],
                function (){
                    fs.unlink('videos/t0.webm');
                });
            }
        }
    }