/**
 * Created by jq on 15/10/2016.
 */

var AWS = require("aws-sdk");
var s3 = new AWS.S3();
var lambda = new AWS.Lambda();
var atob = require("atob");

var S3_BUCKET = 'timeline-user-files';

exports.handle = function (e, ctx, cb) {
    console.log("Saving audio in S3 for user: " + e.params.path.username);
    var body = e['body-json'];

    var filePath = e.params.path.username + '/audio/' + body.FileName;

    var blob = base64toBlob(body.Audio);

    // audio files should be publicly accessible
    var params = {ACL: 'public-read', Bucket: S3_BUCKET, Key: filePath, Body: blob};

    // Upload audio to S3
    s3.upload(params, function (err, data) {
        console.log(err, data);
        if (!err) {
            // save audio as an audio post to user's blog
            createNewAudioPost(body.MobileNo, data.Location);

            cb(null, {
                success: true
            });
        } else {
            cb(null, {
                success: false,
                message: 'Could not upload image to TimeJar.'
            });
        }
    });

};

function createNewAudioPost(mobileNo, audioUrl) {
    var params = {
        FunctionName: "timeline_new_post",
        Payload: JSON.stringify({
            MobileNo: mobileNo,
            Type: 'audio',
            Content: audioUrl
        })
    };

    lambda.invoke(params, function (err, data) {
        if (err) console.log(err, err.stack);
    });
}

function base64toBlob(b64) {
    // convert base64 to raw binary data held in a string
    var byteString = atob(b64);

    // write the bytes of the string to an ArrayBuffer
    var ab = new ArrayBuffer(byteString.length);
    var ia = new Uint8Array(ab);
    for (var i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    // write the ArrayBuffer to a blob, and you're done
    var bb = new Buffer(ia.buffer);
    return bb;
}