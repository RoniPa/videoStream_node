    var uploadPath, supportedTypes;
    var UINT64 = require('cuint').UINT64;
    var v = require('./video_actions');
    
    uploadPath = __dirname + '/../videos';
    supportedTypes = [
        'video/webm; codecs=vp8'
    ];
     
    module.exports = {
        request : request,
        requestOld : requestOld,
        upload  : upload,
        removeClient : removeClient
    };
    
    var clientset = new Set();
    var streamerset = new Set();
    var archiveset = new Set();
    
    var mimeType = "";
    var chunks = [];
    var ebmlHeader = null;
    
    function request(client , meta) {
        //* Send stored webm header to client (as binary data)
        if (ebmlHeader !== null) 
            client.send(ebmlHeader);
        // */
        
        // Add client to set
        clientset.add(client);
        console.log('Added new BinaryClient to request list');
    }
    
    function requestOld(client, meta) {
        archiveset.add(client);
        console.log('Added new BinaryClient to archive list');
        
        v.sendSaved(archiveset, uploadPath, 
            function() {
                // removeClient will be called
                client.close();
            }
        );
    }
    
    function upload(client, stream, meta) {
        mimeType = meta.type;
        
        // Add streamer to set
        // (holds only one instance of each client)
        streamerset.add(client);
        
        // Check mime support
        if (!~supportedTypes.indexOf(meta.type)) {
            console.log("Format not supported!");
            stream.write({ err: 'Unsupported type: ' + meta.type });
            stream.end();
            return;
        }
        
        /* Send stream to clients
        for (var c of clientset) {
            c.send(stream, meta);
        }
        // */
        
        // Store data in memory
        stream.on('data', function (data) {
            console.log("Received data [type: "+meta.type+"]");
            
            // Funktio testaukseen,
            // erottaa ensin headertiedostot ja 
            // yhdistää ne sitten takaisin lähetystä varten.
            // ebml funktion toimivuuden testaukseen.
            v.sendSliced(clientset, data, meta);
            
            if (ebmlHeader === null) ebmlHeader = v.readEbmlHeader(data);
            
            chunks.push(data);
            //* After n chunks write to file
            if (chunks.length >= 7) {
                v.writeVideoToFile(chunks, uploadPath);
            }
            // */
        });
        
        stream.on('end', function () {
            stream.write({ end: true });
        });
    }
    
    // Removes the given client from one of the sets if found
    function removeClient(client) {
        if (clientset.has(client)){
            clientset.delete(client);
            console.log('BinaryClient removed from clientset');
        } else if (archiveset.has(client)) {
            archiveset.delete(client);
            console.log('Archive client removed from archiveset');
        } else if (streamerset.has(client)){
            streamerset.delete(client);
            v.writeVideoToFile(chunks, uploadPath);
            v.finalizeFile(uploadPath);
            ebmlHeader = null;
            chunks = [];
            
            console.log('Streamer removed from streamerset');
        } else {
            console.log('Client not found, could not remove');
        }
    }