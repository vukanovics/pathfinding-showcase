let pathfinding_pb = require('./pathfinding_pb.js');
let pathfinding_node_pb = require('./pathfinding_node_pb.js');
let pathfinding_connection_pb = require('./pathfinding_connection_pb.js');

const UPDATE_FPS = 30;

const CANVAS_WIDTH = 512;
const CANVAS_HEIGHT = 512;

const GRID_LINES = 10;

const GRID_SPACING_X = CANVAS_WIDTH / GRID_LINES;
const GRID_SPACING_Y = CANVAS_HEIGHT / GRID_LINES;

const GRID_LINE_WIDTH_PX = 1;

const NODE_BORDER_WIDTH_PX = 5;

const NODE_SIZE_PX = 32;
const NODE_FILL_COLOR = '#8b50fa';
const NODE_HOVERED_FILL_COLOR = '#b050fa';

const NODE_NUMBER_FONT = "24px Arial";
const NODE_NUMBER_COLOR = "#ddd"

const CONNECTION_WIDTH_PX = 3;
const CONNECTION_COLOR = "black";

const CONNECTION_ARROW_LENGTH_PX = 32;
const CONNECTION_ARROW_ANGLE_RAD = Math.PI/6;

// enums in javascript?
const ToolNone = 0;
const ToolAddNode = 1;
const ToolRemoveNode = 2;
const ToolAddConnection = 3;
const ToolRemoveConnection = 4;
const ToolSetStart = 5;
const ToolSetGoal = 6;

let currentTool = ToolNone;

let selectedNode = -1;

class Node {
    constructor(id, x, y) {
        this.id = id;
        this.x = x;
        this.y = y;
    }
}

class Connection {
    constructor(from_id, to_id) {
        this.from_id = from_id;
        this.to_id = to_id;
    }    
}

let nodes = [];
let connections = [];

let hovered_node_id = -1;

let ws = new WebSocket("ws://127.0.0.1:8888");

ws.binaryType = "arraybuffer";

ws.onopen = function() {
    console.log("connected!");
}

ws.onmessage = function(msg) {
    var command = pathfinding_pb.ToClientCommand.deserializeBinary(msg.data);
    switch (command.getCommandCase()) {
        case pathfinding_pb.ToClientCommand.CommandCase.COMMAND_NOT_SET:
            break;
        case pathfinding_pb.ToClientCommand.CommandCase.NODE_ADDED:
            nodes.push(
                new Node(
                    command.getNodeAdded().getId(),
                    command.getNodeAdded().getX(),
                    command.getNodeAdded().getY()
                )
            );
            break;
        case pathfinding_pb.ToClientCommand.CommandCase.NODE_REMOVED:
            nodes = nodes.filter((node) => {
                return node.id != command.getNodeRemoved().getId();
            });
            // remove connections with one side being the removed node
            connections = connections.filter((connection) => {
                return !(connection.from_id == command.getNodeRemoved().getId() || 
                         connection.to_id == command.getNodeRemoved().getId());
            });
            break;
        case pathfinding_pb.ToClientCommand.CommandCase.CONNECTION_ADDED:
            connections.push(
                new Connection(
                    command.getConnectionAdded().getId1(),
                    command.getConnectionAdded().getId2())
            );
            break;
        case pathfinding_pb.ToClientCommand.CommandCase.CONNECTION_REMOVED:
            connections = connections.filter((connection) => {
                return !(connection.from_id == command.getConnectionRemoved().getId1() &&
                         connection.to_id == command.getConnectionRemoved().getId2());
            });
            break;
    }
}

function sendAddNode(x, y) {
    if (ws.readyState != ws.OPEN) {
        console.log("tried to send a message through socket while it wasn't open");
        return;
    }

    let command = new pathfinding_pb.ToServerCommand();

    let add_node = new pathfinding_node_pb.AddNode();
    add_node.setX(x);
    add_node.setY(y);

    command.setAddNode(add_node);

    let data = command.serializeBinary();

    ws.send(data);
}

function sendRemoveNode(id) {
    if (id == -1) {
        return;
    }

    if (ws.readyState != ws.OPEN) {
        console.log("tried to send a message through socket while it wasn't open");
        return;
    }

    let command = new pathfinding_pb.ToServerCommand();

    let remove_node = new pathfinding_node_pb.RemoveNode();
    remove_node.setId(id);

    command.setRemoveNode(remove_node);

    let data = command.serializeBinary();

    ws.send(data);
}

function sendAddConnection(id1, id2) {
    if (id1 == -1 || id2 == -1) {
        return;
    }

    if (ws.readyState != ws.OPEN) {
        console.log("tried to send a message through socket while it wasn't open");
        return;
    }

    let command = new pathfinding_pb.ToServerCommand();

    let add_connection = new pathfinding_connection_pb.AddConnection();
    add_connection.setId1(id1);
    add_connection.setId2(id2);

    command.setAddConnection(add_connection);

    let data = command.serializeBinary();

    ws.send(data);
}

function sendRemoveConnection(id1, id2) {
    if (id1 == -1 || id2 == -1) {
        return;
    }

    if (ws.readyState != ws.OPEN) {
        console.log("tried to send a message through socket while it wasn't open");
        return;
    }

    let command = new pathfinding_pb.ToServerCommand();

    let remove_connection = new pathfinding_connection_pb.RemoveConnection();
    remove_connection.setId1(id1);
    remove_connection.setId2(id2);

    command.setRemoveConnection(remove_connection);

    let data = command.serializeBinary();

    ws.send(data);
}

function getNodeFromId(id) {
    let found = nodes.filter((node) => {
        return node.id == id;
    });

    if (found.length == 1) {
        return found[0];
    }

    return -1;
}

function clearCanvas() {
    let canvas = document.getElementById("mainCanvas");
    let canvasContext = canvas.getContext("2d");

    canvasContext.clearRect(0, 0, canvas.width, canvas.height);
}

function drawGrid() {
    let canvas = document.getElementById("mainCanvas");
    let canvasContext = canvas.getContext("2d");

    canvasContext.lineWidth = GRID_LINE_WIDTH_PX;
    canvasContext.strokeStyle = "black";

    // we add 1 for the border line
    for (let x = 0; x < GRID_LINES + 1; x++) {
        canvasContext.moveTo(x * GRID_SPACING_X, 0);
        canvasContext.lineTo(x * GRID_SPACING_X, CANVAS_HEIGHT);
        canvasContext.stroke();
    }
    for (let y = 0; y < GRID_LINES + 1; y++) {
        canvasContext.moveTo(0, y * GRID_SPACING_Y);
        canvasContext.lineTo(CANVAS_WIDTH, y * GRID_SPACING_Y);
        canvasContext.stroke();
    }
}

function drawNodes() {
    let canvas = document.getElementById("mainCanvas");
    let canvasContext = canvas.getContext("2d");

    canvasContext.lineWidth = NODE_BORDER_WIDTH_PX;
    canvasContext.strokeStyle = "#000";

    nodes.forEach((node) => {
        canvasContext.beginPath();

        canvasContext.arc(node.x, node.y, NODE_SIZE_PX, 0, 2 * Math.PI);
        canvasContext.fillStyle = NODE_FILL_COLOR;

        if (node.id == hovered_node_id) {
            canvasContext.fillStyle = NODE_HOVERED_FILL_COLOR;
        }

        canvasContext.fill();

        canvasContext.stroke();

        canvasContext.font = NODE_NUMBER_FONT;
        canvasContext.textAlign = "center";
        canvasContext.textBaseline = "middle";
        canvasContext.fillStyle = NODE_NUMBER_COLOR;

        canvasContext.fillText(node.id.toString(), node.x, node.y);
    });
}

function drawConnections() {
    let canvas = document.getElementById("mainCanvas");
    let canvasContext = canvas.getContext("2d");

    canvasContext.lineWidth = CONNECTION_WIDTH_PX;
    canvasContext.strokeStyle = CONNECTION_COLOR;

    connections.forEach((connection) => {
        let node_1 = getNodeFromId(connection.from_id);
        let node_2 = getNodeFromId(connection.to_id);

        if (node_1 == -1 || node_2 == -1) {
            console.log("drawConnections: connection has invalid node id");
            return;
        }

        canvasContext.beginPath();

        canvasContext.moveTo(node_1.x, node_1.y);
        canvasContext.lineTo(node_2.x, node_2.y);
        canvasContext.stroke();

        let angle = Math.atan2(node_2.y - node_1.y, node_2.x - node_1.x);

        canvasContext.moveTo(node_2.x, node_2.y);
        canvasContext.lineTo(node_2.x - CONNECTION_ARROW_LENGTH_PX * Math.cos(angle - CONNECTION_ARROW_ANGLE_RAD),
                             node_2.y - CONNECTION_ARROW_LENGTH_PX * Math.sin(angle - CONNECTION_ARROW_ANGLE_RAD));

        canvasContext.stroke();

        canvasContext.moveTo(node_2.x, node_2.y);
        canvasContext.lineTo(node_2.x - CONNECTION_ARROW_LENGTH_PX * Math.cos(angle + CONNECTION_ARROW_ANGLE_RAD),
                             node_2.y - CONNECTION_ARROW_LENGTH_PX * Math.sin(angle + CONNECTION_ARROW_ANGLE_RAD));
        canvasContext.stroke();
    });

}

function updateCanvas() {
    clearCanvas();
    drawGrid();
    drawNodes();
    drawConnections();

    setTimeout(() => {
        updateCanvas();
    }, 1000 / UPDATE_FPS);
}

function processMouseMove(x, y) {
    hovered_node_id = -1;

    nodes.forEach((node) => {
        var delta_x = node.x - x;
        var delta_y = node.y - y;
        var distance_to_cursor = Math.sqrt(delta_x * delta_x + delta_y * delta_y);

        if (distance_to_cursor < NODE_SIZE_PX) {
            hovered_node_id = node.id;
        }
    });
}

document.getElementById("mainCanvas").onclick = function(event) {
    const canvas = document.getElementById("mainCanvas");

    const x = event.clientX - canvas.getBoundingClientRect().left;
    const y = event.clientY - canvas.getBoundingClientRect().top;

    switch (currentTool) {
        case ToolNone:
            break;
        case ToolAddNode:
            sendAddNode(x, y);
            break;
        case ToolRemoveNode:
            sendRemoveNode(hovered_node_id);
            break;
        case ToolAddConnection:
            if (hovered_node_id == -1) {
                break;
            }
            if (selectedNode == -1) {
                selectedNode = hovered_node_id;
            } else {
                sendAddConnection(selectedNode, hovered_node_id);
                selectedNode = -1;
            }
            break;
        case ToolRemoveConnection:
            if (hovered_node_id == -1) {
                break;
            }
            if (selectedNode == -1) {
                selectedNode = hovered_node_id;
            } else {
                sendRemoveConnection(selectedNode, hovered_node_id);
                selectedNode = -1;
            }
            break;
    }
}

document.getElementById("mainCanvas").onmousemove = function(event) {
    const canvas = document.getElementById("mainCanvas");

    const x = event.clientX - canvas.getBoundingClientRect().left;
    const y = event.clientY - canvas.getBoundingClientRect().top;

    processMouseMove(x, y);
}

document.getElementById("addNodeButton").onclick = function() {
    currentTool = ToolAddNode;
}

document.getElementById("removeNodeButton").onclick = function() {
    currentTool = ToolRemoveNode;
}

document.getElementById("addConnectionButton").onclick = function() {
    currentTool = ToolAddConnection;
}

document.getElementById("removeConnectionButton").onclick = function() {
    currentTool = ToolRemoveConnection;
}

updateCanvas();