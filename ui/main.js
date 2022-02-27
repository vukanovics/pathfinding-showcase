let pathfinding_pb = require('./pathfinding_pb.js');
let pathfinding_node_pb = require('./pathfinding_node_pb.js');

const CANVAS_WIDTH = 512;
const CANVAS_HEIGHT = 512;

const GRID_LINES = 10;

const GRID_SPACING_X = CANVAS_WIDTH / GRID_LINES;
const GRID_SPACING_Y = CANVAS_HEIGHT / GRID_LINES;

// enums in javascript?
const ToolNone = 0;
const ToolAddNode = 1;
const ToolRemoveNode = 2;
const ToolAddConnection = 3;
const ToolRemoveConnection = 4;
const ToolSetStart = 5;
const ToolSetGoal = 6;

let currentTool = ToolNone;

let ws = new WebSocket("ws://127.0.0.1:8888");

ws.onopen = function() {
    console.log("connected!");
}

ws.onmessage = function(msg) {
    console.log(msg);
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
    console.log("sending ", data);
    ws.send(data);
}

function drawGrid() {
    let canvas = document.getElementById("mainCanvas");
    let canvasContext = canvas.getContext("2d");

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

document.getElementById("mainCanvas").onclick = function(event) {
    var canvas = document.getElementById("mainCanvas");
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

document.getElementById("addNodeButton").onclick = function() {
    currentTool = ToolAddNode;
}

drawGrid();