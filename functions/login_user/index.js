/**
 * This Lambda function tries to find a user
 * via a mobile no and send a verification code
 * via SMS to log them in
 *
 * Created by jq on 13/10/2016.
 */

var AWS = require("aws-sdk");
var dynamodb = new AWS.DynamoDB();
var moment = require("moment");
var request = require('request');
var Chance = require("chance");

var DYNAMODB_USERS_TABLE = "timeline-users";

var TELSTRA_API_URL = 'https://api.telstra.com/v1';
var TELSTRA_KEY = 'pSRAU83oT1Z4NLZ2VLn00Gk5ISkqJGDJ';
var TELSTRA_SECRET = 'X9TTurs72CJcCAfn';
var telstra_token = {};

exports.handle = function (e, ctx, cb) {
    console.log('Attempting to log in user: ' + e.MobileNo);

    if (e.MobileNo.trim() != "") {
        findUserByMobile(e.MobileNo)
            .then(function (data) {
                if (Object.keys(data).length != 0) {
                    console.log("Sending verification code to user: " + e.MobileNo);
                    generateVerificationCode(e.MobileNo);
                    cb(null, {
                        success: true
                    });

                } else {
                    console.log("User not found");
                    cb(null, {
                        success: false,
                        message: "Invalid mobile no!"
                    });
                }
            });
    }
};

/**
 * Generates a random 5 digit code for the user
 */
function generateVerificationCode(mobileNo) {
    var chance = new Chance();
    var code = chance.natural({min: 10000, max: 99999});

    var params = {
        TableName: DYNAMODB_USERS_TABLE,
        Key: {
            MobileNo: {
                S: mobileNo
            }
        },
        AttributeUpdates: {
            Code: {
                Action: "PUT",
                Value: {
                    S: code.toString()
                }
            }
        },
        ReturnValues: "ALL_NEW"
    };

    dynamodb.updateItem(params, function (err, data) {
        if (err) console.log(err, err.stack);
        else {
            sendSMS(mobileNo, "Your login verification code from Timeline: " + code);
        }
    });

}

/**
 * Find a user by mobile no from the DB
 * @param mobile
 * @returns {Promise}
 */
function findUserByMobile(mobile) {
    var params = {
        TableName: DYNAMODB_USERS_TABLE,
        Key: {
            MobileNo: {
                S: mobile
            }
        }
    };

    console.log("Retrieving user from DB");

    return new Promise(function (resolve, reject) {
        dynamodb.getItem(params, function (err, data) {
            if (err) console.log(err, err.stack);
            else resolve(data);
        });
    });
}

/**
 * Sends an SMS to the provided mobile no
 * @param mobileNo
 * @param message
 */
function sendSMS(mobileNo, message) {
    var smsData = JSON.stringify({
        to: mobileNo.replace('+61', '0'),
        body: message
    });

    if (checkTelstraToken()) {
        sendTelstraSMS(smsData);
    }
    else {
        getTelstraToken()
            .then(function (data) {
                sendTelstraSMS(smsData);
            });
    }
}

/**
 * Check Telstra token validity
 * returns true if the token is still valid
 * @returns {boolean}
 */
function checkTelstraToken() {
    /* check if the token expiration is after current time */
    return (Object.keys(telstra_token).length > 0 && telstra_token.expires.isAfter());
}

/**
 * This function requests an OAuth token from Telstra
 * @returns {deferred.promise|*}
 */
function getTelstraToken() {
    var url = TELSTRA_API_URL + '/oauth/token?';
    url += 'client_id=' + TELSTRA_KEY;
    url += '&client_secret=' + TELSTRA_SECRET;
    url += '&grant_type=client_credentials&scope=SMS';

    return new Promise(function (resolve, reject) {
        request.get(url)
            .on('response', function (res) {
                if (res.statusCode == 200) {
                    res.on('data', function (data) {
                        data = JSON.parse(data);
                        telstra_token.value = data.access_token;
                        telstra_token.expires = moment().add(data.expires_in, "s");
                        resolve(data);
                    });
                }
                else {
                    console.log("ERROR " + res.statusCode);
                    reject({success: false});
                }
            });
    });
}

/**
 * Send a request to send an SMS to Telstra
 * @param smsData
 */
function sendTelstraSMS(smsData) {
    var url = TELSTRA_API_URL + '/sms/messages';

    request({
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + telstra_token.value
        },
        uri: url,
        body: smsData,
        method: 'POST'
    }, function (err, res, body) {
        if (body.status != 200) {
            console.log("ERROR " + body.status + ": Could not send request to Telstra!");
            console.log("Res Data: " + body.message);
        }
    });
}