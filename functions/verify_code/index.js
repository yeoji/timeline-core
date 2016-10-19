/**
 * Created by jq on 14/10/2016.
 */

var AWS = require("aws-sdk");
var dynamodb = new AWS.DynamoDB();
var Chance = require('chance');

var DYNAMODB_USERS_TABLE = "timeline-users";

exports.handle = function (e, ctx, cb) {
    console.log('Attempting to verify code for user: ' + e.MobileNo);

    if (e.MobileNo.trim() != "") {
        verifyUserCode(e.MobileNo, e.Code)
            .then(function (data) {
                cb(null, data);
            })
            .catch(function (err) {
                cb(null, err);
            });
    }
};

function verifyUserCode(mobileNo, code) {
    var chance = new Chance();

    var params = {
        TableName: DYNAMODB_USERS_TABLE,
        Key: {
            MobileNo: {
                S: mobileNo
            }
        }
    };

    console.log("Retrieving user from DB");

    return new Promise(function (resolve, reject) {
        dynamodb.getItem(params, function (err, data) {
            if (err) console.log(err, err.stack);
            else {
                console.log(data);
                var userCode = data.Item.Code.S;
                if (userCode == code) {
                    var secret = chance.hash();
                    saveUserSecret(data.Item.MobileNo.S, secret)
                    resolve({
                        success: true,
                        secret: secret,
                        username: data.Item.Username.S
                    });
                } else {
                    reject({
                        success: false,
                        message: 'Invalid verification code!'
                    });
                }
            }
        });
    });
}

function saveUserSecret(mobileNo, secret) {
    var params = {
        TableName: DYNAMODB_USERS_TABLE,
        Key: {
            MobileNo: {
                S: mobileNo
            }
        },
        AttributeUpdates: {
            Secret: {
                Action: "PUT",
                Value: {
                    S: secret
                }
            }
        },
        ReturnValues: "ALL_NEW"
    };

    return new Promise(function (resolve, reject) {
        dynamodb.updateItem(params, function (err, data) {
            if (err) console.log(err, err.stack);
            else {
                resolve(data);
            }
        });
    });
}