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
    var metaPackage = null;
    
    function request(client , meta) {
        clientset.add(client);
        
        if (metaPackage !== null)
            client.send(metaPackage, {type:meta.type});
        
        console.log('Uusi BinaryClient lisätty request-listaan');
    }
    
    function upload(stream, meta) {
        if (!~supportedTypes.indexOf(meta.type)) {
            console.log("Format not supported!");
            stream.write({ err: 'Unsupported type: ' + meta.type });
            stream.end();
            return;
        }
        
        stream.on('data', function (data) {
            console.log("Vastaanotettu dataa [type: "+meta.type+"]");
            
            if (metaPackage === null)
                metaPackage = data;
            
            // Iterate clientset, send data
            for (var client of clientset) {
                client.send(data, {type:meta.type});
            }
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
        } else console.log('BinaryClient not found from list, could not remove');
    }