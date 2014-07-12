#!/usr/bin/env node

var Path = require('path');
var Log4js = require('log4js');
var Tracker = require(__dirname + '/../../libs/tracker');
var Csv = require('csv');

var logger = Log4js.getLogger(Path.basename(__filename)),
  desiredPrices = [],
  smtpConfig = null,
  trackRules = null;

loadCSV(function(err) {
  if (err) {
    logger.error('"desired_prices.csv" is invalid. Program terminated.');
  } else {
    loadSMTPConfig();
    loadTrackRules();
    var tracker = new Tracker(desiredPrices, trackRules, smtpConfig);
    tracker.track(function(err) {
      if (err) {
        logger.error(err.message);
      } else {
        logger.info('Program ends successfullly.');
      }
    });
  }
});

function loadCSV(callback) {
  var  properties = null;
  Csv()
    .from.path(__dirname + '/../../configs/desired_prices.csv')
    .on('data', function(data) {
      if (desiredPrices.length === 0 && !properties) {
        properties = data.split(',');
      } else {
        data = data.replace(/^\s+|\s+$/g, '');
        var item = {},
          values = data.split(',');
        for (var i = 0; i < properties.length; i++) {
          item[properties[i]] = values[i];
        }
        desiredPrices.push(item);
      }
    })
    .on('end', function(count) {
      logger.info('"desired_prices.csv" is loaded, total number of lines: ' + count);
      callback();
    })
    .on('error', callback);
}

function loadSMTPConfig() {
  // SMTP configuration should not be from user's input.
  smtpConfig = require(__dirname + '/../../configs/smtp_config.json');
}

function loadTrackRules() {
  // track rules should not be from user's input.
  trackRules = require(__dirname + '/../../configs/track_rules.json');
}
