    var UINT64 = require('cuint').UINT64;
    var fs = require('fs');
    var execFile = require('child_process').execFile;
    
    module.exports = {
        readEbmlHeader : readEbmlHeader,
        parseSimpleBlock  : parseSimpleBlock,
        sendSliced : sendSliced,
        sendSaved : sendSaved,
        writeVideoToFile : writeVideoToFile,
        finalizeFile : finalizeFile
    };
    
    var vInd = 0;
    
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
    var ebmlHeader = null;
    
    function sendSliced(clientset, data, meta) {
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
    
    function sendSaved(clientset, uploadPath, callBack) {
        var fStream = fs.createReadStream(uploadPath +'/final.webm');
        var chunks = [];
        
        for (var c of clientset) {
            var stream = c.createStream();
            fStream.pipe(stream);
            
            fStream.on('close', callBack);
        }
        
    }
    
    function writeVideoToFile(chunks, uploadPath) {
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
        // */
        
        /*
        if (vInd !== 1)
            fStream.write(ebmlHeader);
        // */
        
        var l = 0;
        var cl = chunks.length;
        
        for (var i = cl-1; i >= 0; i--) {
            var c = chunks.shift();
            l += c.length;
            fStream.write(c);
        }
        
        console.log("Wrote "+ l +" bytes to file "+ FILE1);
    }
    
    // Append all videofiles to a single file
    function finalizeFile(uploadPath) {
        if (vInd > 0) {
            var maxInd = vInd - 1;
            vInd = 0;
            
            finalLoop();
        }
        
        function finalLoop(err){
            if (err) throw err;
            
            vInd++;
            if (vInd <= maxInd) {
                var fileurl = uploadPath+ '/t'+vInd+'.bin';
                fs.readFile(fileurl, function(err, data) {
                    if (err) throw err;
                    
                    console.log("Will append "+ data.length +" bytes to file "+ uploadPath +"/t0.bin");
                    fs.appendFile(uploadPath+ '/t0.bin', data, finalLoop); 
                    fs.unlink(fileurl);
                });
            } else {
                //* Final conversion with mse_webm_remuxer
                execFile('bin/mse_webm_remuxer',
                    [   uploadPath +'/t0.bin', 
                        uploadPath +'/final.webm'
                    ],
                function () {
                    fs.unlink(uploadPath +'/t0.bin');
                });
                // */
            }
        }
    }