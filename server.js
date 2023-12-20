const { on } = require('events');
const express = require('express')
const app = express()
app.use(express.json());
const APP_PORT = 3000;
var DEFAULT_INTERVAL_TIME_MS = 30000;
var K6_WAIT_TIME_IN_MIN = 10;
var K6_HOST = "k6.loadclient03.getanton.com";

function testRunner(id) {
    console.log("This function is executed at regular intervals " + id);
}

function printConfigs() {
    console.log("K6_HOST " + K6_HOST);
    console.log("K6_WAIT_TIME_IN_MIN " + K6_WAIT_TIME_IN_MIN);
    console.log("DEFAULT_INTERVAL_TIME_MS " + DEFAULT_INTERVAL_TIME_MS);
}

function urlRunner(urlToRun) {
    const parsedUrl = new URL(urlToRun);
    var startingOptions = {
        host: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        port: 80,
    };
    
    console.log("Firing Url");

    makeHttpGetCall(startingOptions, function(completeResponse, error){
        if(error != null){
            console.log("Got error: " + error.message);
        }else{
            console.log("Response " + completeResponse);
        }
    });
}

var idToInterval = {};
var idToStartTime = {};
var idToType = {};
const TYPE_TEST = "test";
const TYPE_K6 = "k6";
const TYPE_URL = "url";
function makeHttpGetCall(options, callback){
    var http = require('http');
    var completeResponse = "";
    http.get(options, function(resp){
        resp.on('data', function(responseDataBytes){
            responseData = responseDataBytes.toString('utf-8');
            completeResponse += responseData;
        });
        resp.on('end', function(){
            callback(completeResponse, null);
        });
        resp.on('error', function(e){
            callback(null, e);
        });
    }).on("error", function(e){
        callback(null, e);
    });
}

function k6Runner(scenarioToRun, urlToRun) {
    
    const parsedUrl = new URL(urlToRun);
    var statusCallOptions = {
        host: K6_HOST,
        path: '/status/' + scenarioToRun,
        port: 80,
    };

    makeHttpGetCall(statusCallOptions, function(completeResponse, error){
        if(error != null){
            console.log("Got error: " + error.message);
        }else{
            if( completeResponse.indexOf('vus............................:') != -1){
                console.log("K6 run is completed for scenario " + scenarioToRun);
                //K6 run completed
                var resetOptions = {
                    host: K6_HOST,
                    path: '/reset/',
                    port: 80,
                };
                console.log("Resetting k6");
                makeHttpGetCall(resetOptions, function(completeResponse, error){
                    if(error != null){
                        console.log("Got error: " + error.message);
                    }else{
                        var currentTimePlus10Min = new Date();
                        currentTimePlus10Min.setMinutes(currentTimePlus10Min.getMinutes() + K6_WAIT_TIME_IN_MIN);
                        idToStartTime[scenarioToRun] = currentTimePlus10Min;
                    }
                });
            }else if(completeResponse.indexOf('Invalid service name') != -1 || completeResponse.indexOf('No status available Error') != -1){
                //if current time is less than idToStartTime[scenarioToRun], then return
                var currentTime = new Date();
                if(idToStartTime[scenarioToRun] != null && currentTime < idToStartTime[scenarioToRun]){
                    console.log("K6 is not running for " + scenarioToRun + " and current time " + currentTime + " is less than idToStartTime " + idToStartTime[scenarioToRun]);
                    return;
                }
                console.log("K6 is not running for " + scenarioToRun);
                
                var startingOptions = {
                    host: parsedUrl.hostname,
                    path: parsedUrl.pathname + parsedUrl.search,
                    port: 80,
                };
                console.log("Starting k6");
                makeHttpGetCall(startingOptions, function(completeResponse, error){
                    if(error != null){
                        console.log("Got error: " + error.message);
                    }else{
                        console.log("k6 started");
                    }
                });
            }else{
                console.log("k6 already running");
            }
        }
    });
}

app.post('/start/:id', (req, res) => {
    var queryParams = req.query;
    var reqBody = req.body;
    var idToRun = req.params.id;
    var urlToRun = reqBody.url;
    var type = reqBody.type;
    var scenarioName = reqBody.scenarioName;
    var intervalTime = queryParams.interval ? queryParams.interval : DEFAULT_INTERVAL_TIME_MS;
    //check if idToInterval contains the id and a non null value
    if(idToInterval[idToRun] != null){
        res.statusCode = 500;
        res.send('Runner with id ' + idToRun + ' is already running');
        return;
    }

    if(type == TYPE_TEST){
        var intervalId = setInterval(() => testRunner(idToRun), intervalTime);
        idToInterval[idToRun] = intervalId;
        idToType[idToRun] = type;
        res.send('Started runner ' + idToRun + ' successfully');
    }else if(type == TYPE_URL){
        if(urlToRun == null || urlToRun == ''){
            res.statusCode = 500;
            res.send('Url to run is not valid');
            return;
        }
        var intervalId = setInterval(() => urlRunner(urlToRun), intervalTime);
        idToInterval[idToRun] = intervalId;
        idToType[idToRun] = type;
        res.send('Started runner ' + idToRun + ' successfully');
    }else if(type == TYPE_K6){
        if(urlToRun == null || urlToRun == ''){
            res.statusCode = 500;
            res.send('Url to run is not valid');
        }else{
            // start urlrunner with the urlToRun
            var intervalId = setInterval(() => k6Runner(scenarioName, urlToRun), intervalTime);
            idToInterval[idToRun] = intervalId;
            idToType[idToRun] = type;
            res.send('Started runner ' + idToRun + ' successfully');
        }
    }else{
        res.statusCode = 500;
        res.send('Type ' + type + ' is not supported');
    }
});

//api to clear the interval if running
app.get('/stop/:id', (req, res) => {
    var idToStop = req.params.id;
    var intervalId = idToInterval[idToStop];
    if(intervalId != null){
        clearInterval(intervalId);
        delete idToInterval[idToStop];
        delete idToStartTime[idToStop];
        delete idToType[idToStop];
        res.send('Runner stopped successfully');
    }else{
        res.statusCode = 500;
        res.send('There is no runner running with this id ' + idToStop);
    }
});

//api to get the status of the runner
app.get('/status/:id', (req, res) => {
    var idToCheck = req.params.id;
    var intervalId = idToInterval[idToCheck];
    if(intervalId != null){
        res.send('Runner ' + idToCheck + ' is in RUNNING state');
    }else{
        res.send('No Runner with the id ' + idToCheck);
    }
});

//api to list all the runners
app.get('/list', (req, res) => {
    var queryParams = req.query;
    var scenarioName = queryParams.scenario;
    var runners = [];
    for(var key in idToInterval){
        var obj = {
            id: key,
            type: idToType[key],
            lastRunAt: idToStartTime[key],
        };
        if(obj.type == TYPE_K6){
            var startingOptions = {
                host: K6_HOST,
                path: '/list/' + scenarioName,
                port: 80,
            };
            
            makeHttpGetCall(startingOptions, function(completeResponse, error){
                if(error != null){
                    console.log("Got error: " + error.message);
                }else{
                    console.log("Response " + completeResponse);
                    completeResponse = JSON.parse(completeResponse);
                    obj.logs = [];
                    //completeResponse is an array of strings, check if its set and non empty
                    if(completeResponse != null && completeResponse.length > 0){
                        for(var i = 0; i < completeResponse.length; i++){
                            var lastrun = completeResponse[i];
                            var url = "http://" + K6_HOST + "/fetch/" + scenarioName + "/" + lastrun;
                            obj.logs.push(url);
                        }
                    }
                    res.send(runners);
                }
            });
        }
        runners.push(obj);
    }
    if(runners.length == 0){
        res.send(runners);
    }
});

//http://svc-k6-k6.k6.svc.cluster.local/start/sofa-shop-inventory?rndlimit=${rndlimit}&rndon=${rndon}&rndmemon=${rndmemon}&vus=${init_vus}&mvus=${max_vus}&timeunit=${time_unit}&stages=${sofa_shop_inventory_traffic}&rate=5&k6ScriptFilePath=/usr/src/app/k6script-inventory.js"

//api to update the configs (K6_HOST, K6_WAIT_TIME_IN_MIN, DEFAULT_INTERVAL_TIME_MS ) and print the updated configs using the printConfigs function
app.post('/configs', (req, res) => {
    var reqBody = req.body;
    var k6Host = reqBody.k6Host;
    var k6WaitTimeInMin = reqBody.k6WaitTimeInMin;
    var intervalTimeMs = reqBody.intervalTimeMs;
    if(k6Host != null && k6Host != ''){
        K6_HOST = k6Host;
    }
    if(k6WaitTimeInMin != null && k6WaitTimeInMin != ''){
        K6_WAIT_TIME_IN_MIN = k6WaitTimeInMin;
    }
    if(intervalTimeMs != null && intervalTimeMs != ''){
        DEFAULT_INTERVAL_TIME_MS = intervalTimeMs;
    }
    res.send('Updated configs successfully');
    printConfigs();
});

app.listen(APP_PORT, () => {
    console.log(`Example app listening on port ${APP_PORT}`)
    printConfigs();
})