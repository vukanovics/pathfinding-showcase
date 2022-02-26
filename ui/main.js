var pathfinding_pb = require('./pathfinding_pb.js');
var pathfinding_node_pb = require('./pathfinding_node_pb.js');

var ws = new WebSocket("ws://127.0.0.1:8888");
ws.onopen = function() {
    var command = new pathfinding_pb.ToServerCommand();
    var add_node = new pathfinding_node_pb.AddNode();
    add_node.setX(2.5);
    add_node.setY(5.5);
    command.setAddNode(add_node);

    var data = command.serializeBinary();

    console.log(data);
    ws.send(data);
}
ws.onmessage = function(msg) {
    console.log(msg);
}