/*jshint node:true */
'use strict';

var Http = require('http');
var Path = require('path');
var Log4js = require('log4js');
var Async = require('async');
var Nodemailer = require('nodemailer');
var Promise = require('es6-promise').Promise;

module.exports = Tracker;

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
  this.filename = Path.basename(__filename);
  this.taskQ = null;
  this.timeInterval = 5000; // Time interval for querying. Shorter interval means querying faster and may hurt the sites.
  // TODO: more stricted data validation is required.
  this.desiredPrices = desiredPrices;
  this.smtpConfig = smtpConfig;
  this.rules = trackRules;

  this.logger = Log4js.getLogger(Path.basename(__filename));
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
  var self = this;
  this.taskQ = Async.queue(function(task, callback) {

      function reqAsync() {
        return new Promise(function(resolve, reject) {
          var body = '';
          var req = Http.get(task.url, function(res) {
            self.logger.info('Response for ' + task.url + ': ' + res.statusCode);
            if (res.statusCode !== 200) {
              req.abort();
              var message = 'The target url ( ' + task.url + ' ) is not normal.';
              self.logger.warn(message);
              reject(new Error(message));
            } else {
              res.on('data', function(chunk) {
                body += chunk;
              });
              res.on('end', function() {
                self.logger.info('Connection ended');
                resolve(body);
              });
            }
          }).on('error', function(e) {
            self.logger.error('Got error, ' + e.message + ', while requesting ' + task.url);
            reject(e);
          });
        });
      }

      reqAsync().then(function(response) {
        // Check prices
        self.logger.info('Target price for ' + task.url + ' is ' + task.targetPrice);
        var currentPrice = self._find(task.url, response),
          message = '';
        if (currentPrice) {
          if (parseInt(currentPrice) <= parseInt(task.targetPrice)) {
            message = '"' + task.targetPrice + '" is reached in ' + task.url;
            self.logger.info(message);
            // Worth notifying users.
            return message;
          } else {
            // NOT worth notifying users, but worth recording.
            return;
          }
        } else {
          message = 'Regular expression for ' + task.url + ' is wrong or non-exitent.';
          self.logger.warn(message);
          // Notify for regular expression needs to be changed.
          self._notify(self.smtpConfig.user, message);
          // not necessary to notify users.
          return;
        }
      }).catch(function(error) {
        // Notify users that the respone of the page is not normal
        self._notify(task.email, error.message);
        // continue to the next link
        //throw 'Continue to the next link';
      }).then(function(message) {
        // Notify or not
        if (message) {
          self._notify(task.email, message);
        }
      }).then(function() {
          // Wait a little bit
          setTimeout(callback, self.timeInterval);
      }).catch(function(error) {
          setTimeout(function(){
            callback(error);
          }, self.timeInterval);
      });

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
   * @param {function} callback Callback function for Promise.
   */
  Tracker.prototype._notify = function(email, message, callback) {
    if (this.smtpConfig) {
      this.logger.info('Sending an email.');
      var smtpTransport = Nodemailer.createTransport('SMTP', this.smtpConfig);
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
      });
    } else {
      var e = new Error('SMTP configuration is invalid.'); 
      this.logger.error(e.message);
      callback(e);
    }
  };
