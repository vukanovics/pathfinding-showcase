let pathfinding_pb = require('./pathfinding_pb.js');
let pathfinding_node_pb = require('./pathfinding_node_pb.js');

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

// enums in javascript?
const ToolNone = 0;
const ToolAddNode = 1;
const ToolRemoveNode = 2;
const ToolAddConnection = 3;
const ToolRemoveConnection = 4;
const ToolSetStart = 5;
const ToolSetGoal = 6;

let currentTool = ToolNone;

class Node {
    constructor(id, x, y) {
        this.id = id;
        this.x = x;
        this.y = y;
    }
}

let nodes = [];

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

function clearCanvas() {
    let canvas = document.getElementById("mainCanvas");
    let canvasContext = canvas.getContext("2d");

    canvasContext.clearRect(0, 0, canvas.width, canvas.height);
}

function drawGrid() {
    let canvas = document.getElementById("mainCanvas");
    let canvasContext = canvas.getContext("2d");

    canvasContext.lineWidth = GRID_LINE_WIDTH_PX;

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

    nodes.forEach((node, _) => {
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

function updateCanvas() {
    clearCanvas();
    drawGrid();
    drawNodes();

    setTimeout(() => {
        updateCanvas();
    }, 1000 / UPDATE_FPS);
}

function processMouseMove(x, y) {
    hovered_node_id = -1;

    nodes.forEach((node, _) => {
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

updateCanvas();