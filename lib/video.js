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
            
            // Funktio testaukseen,
            // erottaa ensin headertiedostot ja 
            // yhdistää ne sitten takaisin lähetystä varten.
            // ebml funktion toimivuuden testaukseen.
            sendSliced(data, meta);
            
            if (ebmlHeader === null) ebmlHeader = readEbmlHeader(data);
            
            chunks.push(data);
            /* After n chunks write to file
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
        var FILE1 = uploadPath+ '/t'+vInd+'.bin';
        var fStream = fs.createWriteStream(FILE1);
        
        vInd++;
        
        /*
        type Block struct {
        	id       uint64
        	timecode int64
        	flags    uint8
        	data     []byte
        }

        func (b *Block) IsKeyframe() bool {
        	return (b.flags & 0x80) != 0
        }

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
                var fileurl = uploadPath+ '/t'+vInd+'.bin';
                fs.appendFile(uploadPath+ '/t0.bin', fileurl, finalLoop(err));
                fs.unlink(fileurl);
            } else {
                //* Final conversion with mse_webm_remuxer
                execFile('bin/mse_webm_remuxer',
                ['videos/t0.bin', 'videos/final.webm'],
                function () {
                    fs.unlink('videos/t0.bin');
                });
                // */
            }
        }
    }
    
    // Returns new Buffer with the binary EBML header
    function readEbmlHeader(data) {
        // TypedArray ja Buffer jakavat saman muistin
        // Liput: CR, LF, 01 (parillinen)
        var masks = new Buffer(new Uint8Array([0x0D, 0x0A, 0x01]));
        var buff = new Buffer(new Uint8Array(data));
        var charEndBuff = new Buffer(4);
        
        // stringin suorituskyky vs node Buffer?
        // tyyppimuunnosten | muokkausoperaatioiden hintavuus?
        // pitää testata suorituskykyä
        var resultBuff = "";
        var curInd = 0;
        
        charEndBuff.fill(0);
        
        for (var i = 0; i < buff.length; i++) {
            var char = buff[i];
            
            if (!(charEndBuff[3] ^ masks[1])) { // cEB === LF
                return new Buffer(resultBuff, 'binary');
            }
            
            // Onko bitwise-operaattoreiden käyttö loogisten operaattoreiden
            // tilalla tyhmää int8 arvoilla? Vaatii suorituskykytestausta!
            if (curInd < 4) {
                if (!((char ^ masks[0]) | (curInd & masks[2])) // char === CR, curInd parillinen
                || !((char ^ masks[1]) | ((curInd & masks[2])-1)) // char === LF, curInd pariton
                ) {
                    charEndBuff[curInd] = char;
                    curInd++;
                }
            }
            
            resultBuff += String.fromCharCode(char);
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