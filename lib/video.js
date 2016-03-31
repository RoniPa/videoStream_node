    var fs, uploadPath, supportedTypes;
     
    fs = require('fs');
    uploadPath = __dirname + '/../videos';
    supportedTypes = [
        'video/mp4',
        'video/webm; codecs=vp8',
        'video/ogg'
    ];
     
    module.exports = {
        request : request,
        upload  : upload,
        removeClient : removeClient
    };
    
    var clientset = new Set();
    
    function request(client /*, meta*/) {
        clientset.add(client);
        console.log('Uusi BinaryClient lisätty request-listaan');
    }
    
    function upload(stream, meta) {
        if (!~supportedTypes.indexOf(meta.type)) {
            console.log("Format not supported!");
            stream.write({ err: 'Unsupported type: ' + meta.type });
            stream.end();
            return;
        }
        
        // var file = fs.createWriteStream(uploadPath + '/' + meta.name);
        // stream.pipe(file);
        
        stream.on('data', function (data) {
            console.log("Vastaanotettu dataa [type: "+meta.type+"]");
            
            // Iterate clientset, send data
            for (var client of clientset){
                client.send(data, {type:meta.type});
            }
        });
        
        stream.on('end', function () {
            stream.write({ end: true });
        });
    }
    
    function removeClient(client){
        if (clientset.has(client)){
            clientset.delete(client);
            console.log('BinaryClient removed from clientset');
        } else console.log('BinaryClient not found from list, could not remove');
    }