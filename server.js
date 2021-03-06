var binaryjs = require("binaryjs");
var fs = require("fs");
var http = require('http');
var path = require('path');
var video = require('./lib/video');
var va = require('./lib/video_actions');

var express = require('express');
var $PORT = process.env.PORT;
var $IP = process.env.IP;

// configure express app
var router = express();
router.use(express.static(path.resolve(__dirname, 'public')));
router.set('view engine', 'jade');

// create a server with the express app as a listener
var server = http.createServer(router).listen($PORT, $IP);

router.get("/", function(req,res){
  res.render('home');
});

router.get("/stream", function(req,res){
  res.render('stream');
});

router.get("/recorded", function(req,res){
  res.render('old');
});

/***************************** BINARY STREAMING *****************************/

var binaryserver = new binaryjs.BinaryServer({server: server, path: '/stream'});

binaryserver.on('connection', function(client){
  client.on('stream', function (stream, meta) {
    switch(meta.event) {
      // request for a video
      case 'request':
          if (meta.eventType == 'recorded')
              video.requestOld(client, meta);
              
          else video.request(client, meta);
          break;
      
      // streamer connection
      case 'upload':
          video.upload(client, stream, meta);
          break;
      
      default:
    }
  });
  
  client.on('close', function(){
    video.removeClient(this);
  });
});

console.log("Server running at http://"+$IP+":"+$PORT);

// va.scanFile(fs.readFileSync('./videos/testfile.bin'));