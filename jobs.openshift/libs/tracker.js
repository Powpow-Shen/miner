/*jshint node:true */
'use strict';

/**
 * @class Tracker
 */

/**
 * @constructor Tracker
 * @param {array} desiredPrices Desired prices. Ex: [{"url": "http://...", targetPrice: ["x", "bb"], "email": "xxx@xxx.com"}]
 * @param {array} trackRules Rules for tracking.
 * Ex: [{"host": "www.amazon.com", "regex": "a-color-price'>\$.*</span>", "groups": ["2", "1"]}]. The order in "groups" is also important.
 * @param {object} smtpConfig Smtp server configuration for sending email notifications. Ex: {"user": "zz@gmail.com", "pass": "@@@@"}
 */
function Tracker(desiredPrices, trackRules, smtpConfig) {
  this.filename = require('path').basename(__filename);
  this.taskQ = null;
  this.timeInterval = 5000; // Time interval for querying. Shorter interval means querying faster and may hurt the sites.
  // TODO: more stricted data validation is required.
  this.desiredPrices = desiredPrices;
  this.smtpConfig = smtpConfig;
  this.rules = trackRules;

  this.logger = require('log4js').getLogger(require('path').basename(__filename));
}

/**
 * @method track
 * @param callback Callback function
 */
Tracker.prototype.track = function(callback) {
  this._setUpQ();
  var error = null,
    self = this;
  this.taskQ.drain = function() {
    self.logger.info('All track is done.');
    callback(error);
  };
  for (var i in this.desiredPrices) {
    if (this.desiredPrices.hasOwnProperty(i)) {
      /*jshint loopfunc: true */
      this.taskQ.push(this.desiredPrices[i], function(err) {
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
Tracker.prototype._setUpQ = function() {
  var http = require('http'),
    self = this;
  this.taskQ = require('async').queue(function(task, callback) {

    setTimeout(query, self.timeInterval);

    function query() {
      var body = '';
      http.get(task.url, function(res) {
        self.logger.info('Response for ' + task.url + ': ' + res.statusCode);
        res.on('data', function(chunk) {
          body += chunk;
        });
        res.on('end', function() {
          self.logger.info('Connection ended');
          self.logger.info('Target price for ' + task.url + ' is ' + task.targetPrice);
          var currentPrice = self._find(task.url, body),
            message = '';
          if (currentPrice) {
            if (parseInt(currentPrice) <= parseInt(task.targetPrice)) {
              message = '"' + task.targetPrice + '" is reached in ' + task.url;
              self.logger.info(message);
              // Worth notifying
              self._notify(task.email, message, callback);
            } else {
              // NOT worth notifying, but worth recording.
              callback();
            }
          } else {
            message = 'Regular expression for ' + task.url + ' is wrong or non-exitent.';
            self.logger.warn(message);
            // Notify for regular expression needs to be changed.
            self._notify(self.smtpConfig.user, message, callback);
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
 * Find the current price.
 * @param {string} url Where the source is from.
 * @param {string} data Source.
 * @return {integer} Current price in data. Will be null if current price can't be found.
 */
Tracker.prototype._find = function(url, data) {
  var hostname = url.match(new RegExp("^(([^:/?#]+):)?(//([^/?#]*))?([^?#]*)(\\?([^#]*))?(#(.*))?"))[4],
    regex = null, // The regular expression for parse data.
    groups = null, // Group numbers for subexpression. Due to there may be more than one prices on the page. 
    currentPrice = null; // The founded current price
  // Find the regular expression for the host
  for (var i = 0; i < this.rules.length; i++) {
    if (this.rules[i].host === hostname) {
      regex = this.rules[i].regex;
      groups = this.rules[i].groups;
    }
  }

  if (regex) {
    var prices = data.match(regex);
    if (prices) {
      for (i = 0; i < groups.length; i++) {
        if (prices[groups[i]]) {
          currentPrice = prices[groups[i]];
        }
      }
    }
    this.logger.info('Current price in ' + url + ' is ' + currentPrice);
  }

  return currentPrice;
};

/**
 * @method _notify
 * @param {string} email Email address for sending a mail.
 * @param {string} message The message will be sent.
 * @param {function} callback Callback function.
 */
Tracker.prototype._notify = function(email, message, callback) {
  var nodemailer = require('nodemailer');
  if (this.smtpConfig) {
    this.logger.info('Sending an email.');
    var smtpTransport = nodemailer.createTransport('SMTP', this.smtpConfig);
    var mailOptions = {
      from: this.smtpConfig.user,
      to: email,
      subject: 'Miner got something for you',
      text: message,
      html: '<br>' + message + '</b>'
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

module.exports = Tracker;
