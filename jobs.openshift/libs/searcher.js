/*jshint node:true */
'use strict';

var Http = require('http');
var Path = require('path');
var Log4js = require('log4js');
var Async = require('async');
var Nodemailer = require('nodemailer');

module.exports = Searcher;
/**
 * @class Searcher
 */

/**
 * @constructor Searcher
 * @param {array} desiredObj Desired objects. Ex: [{"url": "http://...", keywords: ["x", "bb"], "email": "xxx@xxx.com"}]
 * @param {object} smtpConfig Smtp server configuration for sending email notifications. Ex: {"user": "zz@gmail.com", "pass": "@@@@"}
 */
function Searcher(desiredObj, smtpConfig) {
  this.filename = Path.basename(__filename);
  this.message = ' are founded in ';
  this.taskQ = null;
  this.timeInterval = 5000; // Time interval for querying. Shorter interval means querying faster and may hurt the sites.
  // TODO: more stricted data validation is required.
  this.desiredObj = desiredObj;
  this.smtpConfig = smtpConfig;

  this.logger = Log4js.getLogger(Path.basename(__filename));
}

/**
 * @method search
 * @param callback Callback function
 */
Searcher.prototype.search = function(callback) {
  this._setUpQ();
  var error = null,
    self = this;
  this.taskQ.drain = function() {
    self.logger.info('All search is done.');
    callback(error);
  };
  for (var i in this.desiredObj) {
    if (this.desiredObj.hasOwnProperty(i)) {
      /*jshint loopfunc: true */
      this.taskQ.push(this.desiredObj[i], function(err) {
        if (err) {
          self.logger.error(err.message);
          error = new Error('One or more task fail.');
        }
      });
    }
  }
};

/**
 * @method _setUpQ
 */
Searcher.prototype._setUpQ = function() {
  var self = this;
  this.taskQ = Async.queue(function(task, callback) {

    setTimeout(query, self.timeInterval);

    function query() {
      var body = '';
      Http.get(task.url, function(res) {
        self.logger.info('Response for ' + task.url + ': ' + res.statusCode);
        res.on('data', function(chunk) {
          body += chunk;
        });
        res.on('end', function() {
          self.logger.info('Connection ended');
          self.logger.info('Looking for ' + task.keywords);
          var matchedStrings = self._find(body, task.keywords);
          if (matchedStrings.length !== 0) {
            self._notify(task.email, matchedStrings, task.url, callback);
          } else {
            callback();
          }
        });
      }).on('error', function(e) {
        self.logger.error('Got error: ' + e.message);
        callback(e);
      });
    }
  }, 1);
};

/**
 * @method _find
 * Find the matched strings.
 * @param {string} data Source
 * @param {array} keywords Key words
 * @return {array} Matched strings
 */
Searcher.prototype._find = function(data, keywords) {
  var matchedStrings = [],
    dataInLowerCase = data.toLowerCase();
  for (var i = 0; i < keywords.length; i++) {
    if (dataInLowerCase.indexOf(keywords[i].toLowerCase()) !== -1) { // got it
      matchedStrings.push(keywords[i]);
    }
  }
  return matchedStrings;
};

/**
 * @method _notify
 * @param {string} email Email address for sending a mail
 * @param {array} matchedStrings Founded key words
 * @param {string} url Where the key words are found in
 * @param {function} callback Callback function.
 */
Searcher.prototype._notify = function(email, matchedStrings, url, callback) {
  var fullMessage = '"' + matchedStrings + '"' + this.message + url;
  this.logger.info(fullMessage);
  if (this.smtpConfig) {
    this.logger.info('Sending an email.');
    var smtpTransport = Nodemailer.createTransport('SMTP', this.smtpConfig);
    var mailOptions = {
      from: this.smtpConfig.user,
      to: email,
      subject: 'Miner got something for you',
      text: fullMessage,
      html: '<br>' + fullMessage + '</b>'
    };
    var self = this;
    smtpTransport.sendMail(mailOptions, function(err, res) {
      if (err) {
        self.logger.error(err);
      } else {
        self.logger.info('Message sent: ' + res.message);
      }
      smtpTransport.close();
      callback(err);
    });
  } else {
    callback(new Error('SMTP configuration is invalid.'));
  }
};
