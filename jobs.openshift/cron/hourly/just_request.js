#!/usr/bin/env node

var now = new Date();
if (now.getHours() !== 0) {
  process.exit(0);
}
// Run at 24 o'clock
var request = require('request'),
  hosts = require(__dirname + '/../../configs/hosts.json');
for (var i = 0; i < hosts.length; i++) {
  /*jshint loopfunc: true */
  request(hosts[i].url, function(error, response, body) {
    if (!error && response.statusCode == 200) {
      console.log(body);
    }
  });
}
