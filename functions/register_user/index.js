/**
 * This Lambda function registers a new user and a blog
 *
 * Created by jq on 30/09/2016.
 */

var AWS = require("aws-sdk");
var dynamodb = new AWS.DynamoDB();
var moment = require("moment");
var request = require('request');
var Chance = require('chance');

var DYNAMODB_USERS_TABLE = "timeline-users";

var TELSTRA_API_URL = 'https://api.telstra.com/v1';
var TELSTRA_KEY = 'pSRAU83oT1Z4NLZ2VLn00Gk5ISkqJGDJ';
var TELSTRA_SECRET = 'X9TTurs72CJcCAfn';
var telstra_token = {};

var TWILIO_NUMBER = "+61439591208";

console.log("Registering new user");

exports.handle = function (e, ctx, cb) {

    // Create new user in DB
    createUser(e.MobileNo, e.Username)
        .then(function (data) {
            if (e.Context == "sms") {
                sendSMS(e.MobileNo, data.message + "You can now post content via SMS :)");
            } else if (e.Context == "mobile") {
                generateVerificationCode(e.MobileNo);
            }

            cb(null, {
                success: true
            });
        })
        .catch(function (err) {
            cb(null, err);
        });

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
            sendSMS(mobileNo, "Your verification code from Timeline: " + code);
        }
    });

}

/**
 * Creates a user with the specified mobileNo and username
 *
 * @param mobileNo
 * @param username
 */
function createUser(mobileNo, username) {
    var params = {
        TableName: DYNAMODB_USERS_TABLE,
        Item: {
            MobileNo: {
                S: mobileNo
            },
            Username: {
                S: username
            }
        },
        ConditionExpression: "attribute_not_exists(MobileNo) AND attribute_not_exists(Username)"
    };

    return new Promise(function (resolve, reject) {
        dynamodb.putItem(params, function (err, data) {
            if (err) {
                console.log(err, err.stack);
                reject({
                    success: false,
                    message: "Sorry, that username/mobile no has already been registered! Please try again."
                });
            }
            else {
                console.log("User created with username: " + username);
                resolve({
                    success: true,
                    message: "Thanks for registering with TimeJar! You can now post content by sending a text to " + TWILIO_NUMBER + " :)"
                });
            }
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