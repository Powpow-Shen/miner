#!/usr/bin/env node

var logger = require('log4js').getLogger(require('path').basename(__filename)),
  desiredObj = null;
try {
  desiredObj = require(__dirname + '/../../configs/desired_obj.json');
} catch (e) {
  logger.error('"desired_obj.json" is invalid!\nProgram ends.');
  return;
}

// SMTP configuration should not be from user's input.
var smtpConfig = null;
smtpConfig = require(__dirname + '/../../configs/smtp_config.json');

var Searcher = require(__dirname + '/../../libs/searcher');
var searcher = new Searcher(desiredObj, smtpConfig);
searcher.search(function(err) {
  if (err) {
    logger.error(err.message);
  } else {
    logger.info('Program ends successfullly.');
  }
});
