var WebSocket = require('ws');

var words = [];
var nodes = new Map();
var ipCount = 0;
var lastAction = true;

var wsAddNode;
var wsDelNode;
var wsAddEdge;
var wsDelEdge;
readWords();
function readWords() {
    var lineReader = require('readline').createInterface({
        input: require('fs').createReadStream('./list.txt')
    });
    lineReader.on('line', line => {
        if(line != "" && line.trim() != "") {
            words.push(line.trim());
        }
    });
    lineReader.on('close', () => {
        populate();
    });
}

function populate() {
    wsAddNode = new WebSocket('ws://127.0.0.1:9001/add_node');
    wsDelNode = new WebSocket('ws://127.0.0.1:9001/delete_node');
    wsAddEdge = new WebSocket('ws://127.0.0.1:9001/add_edge');
    wsDelEdge = new WebSocket('ws://127.0.0.1:9001/delete_edge');

    wsAddNode.on('open', function open() {
        for(ipCount = 0; ipCount < 10; ipCount++) {
            var name = "";
            name += words[getRandomInt(words.length)] + "-" + words[getRandomInt(words.length)] + ".com";
            while(nodes.has(name))
                name += words[getRandomInt(words.length)] + "-" + words[getRandomInt(words.length)] + ".com";
            var ip = "10." + (Math.floor(ipCount / 65536) % 256) + "." + (Math.floor(ipCount / 256) % 256) + "." +  (ipCount % 256);
            console.log("hostname: " + name + ", ip: " + ip);
            var newNode = {hostname: name, ip: ip};
            wsAddNode.send(JSON.stringify(newNode));
        }
    });
    wsAddNode.on('message', function incoming(data) {
        console.log(data);
        var json = JSON.parse(data);
        json.edges = [];
        nodes.set(json.id, json);
        if(nodes.size == 10) {
            console.log("nodes.size = 10");
            for(var i = 0; i < 24; i++) {
                var source = getRandomInt(nodes.size);
                var target = getRandomInt(nodes.size);
                while(source == target)
                    target = getRandomInt(nodes.size);
                console.log("source num: " + source + ", target num: " + target);
                var max = source > target ? source : target;
                var it = nodes.values();
                var hostSource;
                var hostTarget;
                var current;
                for(var j = 0; j <= max; j++) {
                    current = it.next();
                console.log(current.value)
                    if(j == source)
                        hostSource = current.value;
                    else if(j == target)
                        hostTarget = current.value;
                }
                console.log(hostSource.hostname + " => " + hostTarget.hostname);
                var newEdge = {source: hostSource.id, target: hostTarget.id};
                wsAddEdge.send(JSON.stringify(newEdge));
                nodes.get(hostSource.id).edges.push(newEdge);
                nodes.get(hostTarget.id).edges.push(newEdge);
            }
            setInterval(function() {
                doRandomStuff();
            }, 1000);
        }
    });
}

function doRandomStuff() {
    if(lastAction) {
        // Create new node
        var name = "";
        name += words[getRandomInt(words.length)] + "-" + words[getRandomInt(words.length)] + ".com";
        while(nodes.has(name))
            name += words[getRandomInt(words.length)] + "-" + words[getRandomInt(words.length)] + ".com";
        
        var ip = "10." + (Math.floor(ipCount / 65536) % 256) + "." + (Math.floor(ipCount / 256) % 256) + "." +  (ipCount % 256);
        ipCount++;

        console.log("Add node\n\thostname: " + name + ", ip: " + ip);

        var newNode = {hostname: name, ip: ip};
        newNode.edges = [];
        nodes.set(name, newNode);

        // Add 2/3 new edges from/to new node
        var numEdges = getRandomInt(2) + 2;
        for(var i = 0; i < numEdges; i++) {
            var entry = getRandomInt(nodes.size);
            var it = nodes.values();
            var current;
            for(var j = 0; j < entry; j++) {
                current = it.next().value;
            }
            if(getRandomInt(2) == 0) {
                // Add edge from new node
                var target = current;
                var newEdge = {source: newNode.id, target: target.id};
                console.log("\t" + newNode.hostname + " => " + target.hostname);
                newNode.edges.push(newEdge);
                nodes.get(target.id).edges.push(newEdge);
            } else {
                // Add edge to new node
                var source = current;
                var newEdge = {source: source.id, target: newNode.id};
                console.log("\t" + source.hostname + " => " + newNode.hostname);
                newNode.edges.push(newEdge);
                nodes.get(source.id).edges.push(newEdge);
            }
        }
        // Add new node
        wsAddNode.send(JSON.stringify(newNode));
    } else {
        // Delete a node
        var entry = getRandomInt(nodes.size);
        var it = nodes.values();
        for(var j = 0; j < entry; j++) {
            it.next();
        }
        var node = it.next().value;
        console.log("Delete node\n\thostname: " + node.hostname + ", ip: " + node.ip);
        // Delete all edges to/from node first
        node.edges.forEach(function(element) {
            console.log("\t" + nodes.get(element.source).hostname + " => " + nodes.get(element.target).hostname);
            if(element.source != node.id) {
                deleteEdge(nodes.get(element.source), node.id);
            } else {
                deleteEdge(nodes.get(element.target), node.id);
            }
        });
        // Actually delete node
        wsDelNode.send(JSON.stringify(node));
        delete node.edges;
        nodes.delete(node.id);
    }
    lastAction = !lastAction;
}

function deleteEdge(node, nodeId) {
    for(var i = 0; i < node.edges.length; i++) {
        if(node.edges[i].source == nodeId || node.edges[i].target == nodeId) {
            node.edges.splice(i, 1);
            return;
        }
    }
}

function getRandomInt(max) {
    return Math.floor(Math.random() * (max));
}