    var fs, uploadPath, supportedTypes;
    var execFile = require('child_process').execFile;
    var UINT64 = require('cuint').UINT64;
     
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
    var ebmlHeader = null;
    var vInd = 0;
    
    function request(client , meta) {
        //* Send stored webm header to client (as binary data)
        if (ebmlHeader !== null) 
            client.send(ebmlHeader);
        // */
        
        // Add client to set
        clientset.add(client);
        console.log('Uusi BinaryClient lisätty request-listaan');
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
            console.log("Vastaanotettu dataa [type: "+meta.type+"]");
            chunks.push(data);
            
            // Funktio testaukseen,
            // erottaa ensin headertiedostot ja 
            // yhdistää ne sitten takaisin lähetystä varten.
            // ebml funktion toimivuuden testaukseen.
            sendSliced(data, meta);
            
            if (ebmlHeader === null) ebmlHeader = readEbmlHeader(data);
            
            //* After n chunks write to file    
            if (chunks.length >= 7)
                writeStreamToFile();
            // */
        });
        
        stream.on('end', function () {
            stream.write({ end: true });
            console.log("Data saapunut");
        });
    }
    
    // Removes the given client from one of the sets if found
    function removeClient(client) {
        if (clientset.has(client)){
            clientset.delete(client);
            console.log('BinaryClient removed from clientset');
        } else if (streamerset.has(client)){
            streamerset.delete(client);
            writeStreamToFile();
            finalizeFile();
            ebmlHeader = null;
            
            console.log('Streamer removed from streamerset');
        } else {
            console.log('Client not found, could not remove');
        }
    }
    
    function writeStreamToFile(){
        var FILE1 = uploadPath+ '/t'+vInd+'.webm';
        var fStream = fs.createWriteStream(FILE1);
        
        vInd++;
        
        /*
        var cutData = chunks.pop(0).slice(ebmlHeader.length);
        var ebmlBuf = Buffer.concat([ebmlHeader, cutData]);
        
        fStream.write(ebmlBuf);
        // */
        
        /*
        if (vInd !== 1)
            fStream.write(ebmlHeader);
        // */
        
        for (var c of chunks)
            fStream.write(c);
        
        chunks = [];
    }
    
    // Append all videofiles to a single file
    function finalizeFile() {
        if (vInd > 0) {
            finalLoop();
        }
        
        function finalLoop(err){
            if (err) throw err;
            
            vInd--;
            if (vInd > 0) {
                var fileurl = uploadPath+ '/t'+vInd+'.webm';
                fs.appendFile(uploadPath+ '/t0.webm', fileurl, finalLoop(err));
                fs.unlink(fileurl);
            } else {
                /* Final conversion with mse_webm_remuxer
                execFile('bin/mse_webm_remuxer',
                ['videos/t0.webm', 'videos/final.webm'],
                function () {
                    fs.unlink('videos/t0.webm');
                });
                // */
            }
        }
    }
    
    // Returns string representation of the binary EBML header
    function readEbmlHeader(data) {
        var CR = 0x0D; // \r
        var LF = 0x0A; // \n
        var CR_mask = -0x0E; // \r
        var LF_mask = -0x0B; // \n
        
        var buff = new Buffer(data);
        var charEndBuff = new Buffer(4);
        var resultBuff = "";
        var curInd = 0;
        
        charEndBuff.fill(0);
        for (var i = 0; i < buff.length; i++) {
            var char = buff[i];
            
            if (charEndBuff[3] === LF) {
                resultBuff += charEndBuff;
                charEndBuff.fill(0);
                
                return new Buffer(resultBuff, 'binary');   
            }
            
            if (((char ^ ~CR) === -1 && 
                    (charEndBuff[0] === 0 
                    || (charEndBuff[2] ^ (charEndBuff[1] ^ ~LF) === -1)))
                || ((char ^ ~LF) === -1 && 
                    (((charEndBuff[1] ^ (charEndBuff[0] ^ ~CR)) === -1)
                    || ((charEndBuff[3] ^ (charEndBuff[2] ^ ~CR)) === -1))
                )) {
                    charEndBuff[curInd] = char;
                    curInd++;
                } 
            else resultBuff += String.fromCharCode(char);
        }
        
        return null;
    }
    
    function parseSimpleBlock(data) {
        var buf = new Buffer(data);
        
        // bitwise id size calc
        var mask = 0x80 // 10 00 00 00
        var idSize = 0;
        while ((buf[0] & mask) == 0 && idSize < 8) {
            mask >>= 1;
            idSize++;
        }
        
        if (idSize >= 8) return null;
        
        var headerSize = idSize + 3;
        if (buf.length < headerSize) return null;
        
        var id = UINT64(buf[0] & (mask - 1));
    	for (var i = 1; i < idSize; i++) {
    		id = (id << 8) | UINT64(buf[i]);
    	}
    	
    	var timecode = parseInt(buf[idSize]) << 8 | parseInt(buf[idSize + 1]);
    	if ((timecode & 0x8000) != 0 ) {
    		timecode |= (-1 << 16);
    	}
    	var flags = buf[idSize + 2];
    	
    	return new Buffer([id, timecode, flags, headerSize], 'binary');
    }
    
    // Funktio ebmlheaderien bufferien käsittelyn testaukseen
    function sendSliced(data, meta){
        if (ebmlHeader === null) {
            ebmlHeader = readEbmlHeader(data);
            
            var cutData = data.slice(ebmlHeader.length);
            var ebmlBuf = Buffer.concat([ebmlHeader, cutData]);
            
            for (var c of clientset) {
                c.send(ebmlBuf);
            }
            
        } else {
            for (var c of clientset) {
                c.send(data, meta);
            }
        }
    }