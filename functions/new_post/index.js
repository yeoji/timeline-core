/**
 * This Lambda function creates a new post for the user's blog
 * Created by jq on 30/09/2016.
 */

var AWS = require("aws-sdk");
var dynamodb = new AWS.DynamoDB();

var request = require('request');

var DYNAMODB_USERS_TABLE = "timeline-users";
var TIMELINE_POST_EVENT_URL = "http://timejar.me/events/post";

console.log("Creating new post");

exports.handle = function (e, ctx, cb) {

    switch (e.Type) {
        case "text":
            createTextPost(e.MobileNo, e.Content).then(function(postData) {
                sendNewPostEvent(postData);

                cb(null, {
                    success: true
                });
            });
            break;
        case 'image':
            createImagePost(e.MobileNo, e.Content).then(function(postData) {
                sendNewPostEvent(postData);

                cb(null, {
                    success: true
                });
            });
            break;
        case 'audio':
            createAudioPost(e.MobileNo, e.Content).then(function(postData) {
                sendNewPostEvent(postData);

                cb(null, {
                    success: true
                });
            });
            break;
        default:
            console.log("Could not create post of type: " + e.Type);
            cb(null, {
                success: false
            });
    }
};

/**
 * Attach a new text post to the user's blog
 *
 * @param mobileNo
 * @param content
 */
function createTextPost(mobileNo, content) {
    console.log("Creating text post");

    var post = {
        Type: "text",
        Content: content,
        Timestamp: new Date().toISOString()
    };
    console.log(post);

    var params = {
        TableName: DYNAMODB_USERS_TABLE,
        Key: {
            MobileNo: {
                S: mobileNo
            }
        },
        AttributeUpdates: {
            Posts: {
                Action: "ADD",
                Value: {
                    SS: [JSON.stringify(post)]
                }
            }
        },
        ReturnValues: "ALL_NEW"
    };

    return new Promise(function(resolve, reject) {
        dynamodb.updateItem(params, function (err, data) {
            if (err) console.log(err, err.stack);
            else {
                resolve({
                    username: data.Attributes.Username.S,
                    post: post
                });
            }
        });
    });
}

function createImagePost(mobileNo, content) {
    console.log("Creating image post");

    var post = {
        Type: "image",
        Content: content,
        Timestamp: new Date().toISOString()
    };

    var params = {
        TableName: DYNAMODB_USERS_TABLE,
        Key: {
            MobileNo: {
                S: mobileNo
            }
        },
        AttributeUpdates: {
            Posts: {
                Action: "ADD",
                Value: {
                    SS: [JSON.stringify(post)]
                }
            }
        },
        ReturnValues: "ALL_NEW"
    };

    return new Promise(function(resolve, reject) {
        dynamodb.updateItem(params, function (err, data) {
            if (err) console.log(err, err.stack);
            else {
                resolve({
                    username: data.Attributes.Username.S,
                    post: post
                });
            }
        });
    });
}

function createAudioPost(mobileNo, content) {
    console.log("Creating audio post");

    var post = {
        Type: "audio",
        Content: content,
        Timestamp: new Date().toISOString()
    };

    var params = {
        TableName: DYNAMODB_USERS_TABLE,
        Key: {
            MobileNo: {
                S: mobileNo
            }
        },
        AttributeUpdates: {
            Posts: {
                Action: "ADD",
                Value: {
                    SS: [JSON.stringify(post)]
                }
            }
        },
        ReturnValues: "ALL_NEW"
    };

    return new Promise(function(resolve, reject) {
        dynamodb.updateItem(params, function (err, data) {
            if (err) console.log(err, err.stack);
            else {
                resolve({
                    username: data.Attributes.Username.S,
                    post: post
                });
            }
        });
    });
}

/**
 * Sends a New Post event to the Timeline Web API
 * @param postData
 */
function sendNewPostEvent(postData) {
    request.post(TIMELINE_POST_EVENT_URL, {
        json: postData
    })
        .on('response', function (res) {
            if (res.statusCode != 200) {
                console.log("ERROR " + res.statusCode + ": Could not send New Post event!");
                res.on('data', function (data) {
                    console.log("Data: " + data);
                });
            }
        });
}