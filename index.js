var WebSocket = require('ws');

var words = [];
var nodes = new Map();
var tmpNodes = new Map();
var ipCount = 0;
var lastAction = true;
var timerId;
var stuffCount = 0;

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
        for(ipCount = 0; ipCount < 1000; ipCount++) {
            var name = "";
            name += words[getRandomInt(words.length)] + "-" + words[getRandomInt(words.length)] + ".com";
            while(nodes.has(name))
                name += words[getRandomInt(words.length)] + "-" + words[getRandomInt(words.length)] + ".com";
            var ip = (Math.floor(ipCount / 16777216) % 256) + 1 + "." + (Math.floor(ipCount / 65536) % 256) + "." + (Math.floor(ipCount / 256) % 256) + "." +  (ipCount % 256);
            console.log("hostname: " + name + ", ip: " + ip);
            var newNode = {hostname: name, ip: ip};
            wsAddNode.send(JSON.stringify(newNode));
        }
    });
    wsAddNode.on('message', function incoming(data) {
        //console.log(data);
        var json = JSON.parse(data);
        if(tmpNodes.has(json.hostname)) {
          var addedNode = tmpNodes.get(json.hostname);
          addedNode.id = json.id;
          tmpNodes.delete(addedNode.hostname);
          nodes.set(addedNode.id, addedNode);
          console.log("Added new node: " + "hostname: " + addedNode.hostname + ", ip: " + addedNode.ip + ", id: " + addedNode.id);
          addEdges(addedNode);
        } else {
          json.edges = [];
          nodes.set(json.id, json);
          if(nodes.size == 1000) {
            populateEdges();
          }
        }
        
    });
}

function populateEdges() {
  console.log("nodes.size = 10");
  for(var i = 0; i < 2400; i++) {
    var source = getRandomInt(nodes.size);
    var target = getRandomInt(nodes.size);
    while(source == target)
      target = getRandomInt(nodes.size);
    console.log("source num: " + source + ", target num: " + target);
    var max = source > target ? source : target;
    var it = nodes.values();
    var hostSource;
    var hostTarget;
    var current = it.next();
    for(var j = 0; j <= max; j++) {
      //console.log(current.value)
      if(j == source)
        hostSource = current.value;
      else if(j == target)
        hostTarget = current.value;
      current = it.next();
    }
    console.log(hostSource.hostname + " => " + hostTarget.hostname);
    var newEdge = {source: hostSource.id, target: hostTarget.id};
    wsAddEdge.send(JSON.stringify(newEdge));
    nodes.get(hostSource.id).edges.push(newEdge);
    nodes.get(hostTarget.id).edges.push(newEdge);
  }
  timerId = setInterval(function() {
    doRandomStuff();
  }, 100);
}


function addEdges(node) {
  var numEdges = getRandomInt(2) + 2;
  for(var i = 0; i < numEdges; i++) {
    var entry = getRandomInt(nodes.size);
    var it = nodes.values();
    var current = it.next();
    console.log("nodes size: " + nodes.size + ", entry: " + entry);
    for(var j = 0; j < entry; j++) {
      current = it.next();
    }
    if(getRandomInt(2) == 0) {
      // Add edge from new node
      var target = current.value;
      console.log("2. nodes size: " + nodes.size);
      var newEdge = {source: node.id, target: target.id};
      console.log("\t" + node.hostname + " => " + target.hostname);
      wsAddEdge.send(JSON.stringify(newEdge));
      node.edges.push(newEdge);
      nodes.get(target.id).edges.push(newEdge);
    } else {
      // Add edge to new node
      var source = current.value;
      console.log("2. nodes size: " + nodes.size);
      var newEdge = {source: source.id, target: node.id};
      console.log("\t" + source.hostname + " => " + node.hostname);
      wsAddEdge.send(JSON.stringify(newEdge));
      node.edges.push(newEdge);
      nodes.get(source.id).edges.push(newEdge);
    }
  }
}

function doRandomStuff() {
  if(stuffCount > 900) {
    clearInterval(timerId);
  }
  stuffCount++;

    if(lastAction) {
        // Create new node
        var name = "";
        name += words[getRandomInt(words.length)] + "-" + words[getRandomInt(words.length)] + ".com";
        while(nodes.has(name))
            name += words[getRandomInt(words.length)] + "-" + words[getRandomInt(words.length)] + ".com";
        
        var ip = "10." + (Math.floor(ipCount / 65536) % 256) + "." + (Math.floor(ipCount / 256) % 256) + "." +  (ipCount % 256);
        ipCount++;

        console.log("Add node\n\thostname: " + name + ", ip: " + ip);

        var newNode = {hostname: name, ip: ip, edges: []};
        tmpNodes.set(name, newNode);
        // Add 2/3 new edges from/to new node
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
            console.log("\t" + element.source + " => " + element.target);
            console.log("\t" + nodes.get(element.source).hostname + " => " + nodes.get(element.target).hostname);
            if(element.source != node.id) {
                deleteLocalEdge(nodes.get(element.source), node.id);
            } else {
                deleteLocalEdge(nodes.get(element.target), node.id);
            }
        });
        // Actually delete node
        console.log("Now Delete node\n\thostname: " + node.hostname + ", ip: " + node.ip);
        wsDelNode.send(JSON.stringify(node));
        delete node.edges;
        nodes.delete(node.id);
    }
    lastAction = !lastAction;
}

function deleteLocalEdge(node, nodeId) {
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