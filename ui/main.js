let pathfinding_pb = require('./pathfinding_pb.js');
let pathfinding_node_pb = require('./pathfinding_node_pb.js');
let pathfinding_connection_pb = require('./pathfinding_connection_pb.js');
let pathfinding_path_pb = require('./pathfinding_path_pb.js')

const GRID_SPACING_X_PX = 32;
const GRID_SPACING_Y_PX = 32;

const GRID_LINE_WIDTH_PX = 1;

const NODE_BORDER_WIDTH_PX = 5;

const NODE_SIZE_PX = 32;
const NODE_FILL_COLOR = '#8b50fa';
const NODE_HOVERED_FILL_COLOR = '#b050fa';
const NODE_SELECTED_FILL_COLOR = '#ef50fa';

const NODE_PATH_FILL_COLOR = '#4287f5';
const NODE_PATH_HOVERED_FILL_COLOR = '#5c94ed';
const NODE_PATH_SELECTED_FILL_COLOR = '#6c9deb';

const NODE_NUMBER_FONT = "24px Arial";
const NODE_NUMBER_COLOR = "#ddd"

const CONNECTION_WIDTH_PX = 3;

const CONNECTION_COLOR = "#15002b";
const CONNECTION_PATH_COLOR = "#05c5f0";

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

let current_tool = ToolNone;

let selected_node_id = -1;

let path_start_node_id = -1;
let path_goal_node_id = -1;

class Node {
    constructor(id, x, y) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.active = false;
    }
}

class Connection {
    constructor(from_id, to_id) {
        this.from_id = from_id;
        this.to_id = to_id;
        this.active = false;
    }    
}

let nodes = [];
let connections = [];

let hovered_node_id = -1;

let ws = new WebSocket("ws://127.0.0.1:8888");

ws.binaryType = "arraybuffer";

let camera_position_x = 0;
let camera_position_y = 0;

let previous_mouse_x = 0;
let previous_mouse_y = 0;

let mouse_world_x = 0;
let mouse_world_y = 0;

let dragging_camera = false;

ws.onopen = function() {
    document.getElementById("error").hidden = true;
}

ws.onclose = function() {
    document.getElementById("error").hidden = false;
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
            requestAnimationFrame(updateCanvas);
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
            requestAnimationFrame(updateCanvas);
            break;
        case pathfinding_pb.ToClientCommand.CommandCase.CONNECTION_ADDED:
            connections.push(
                new Connection(
                    command.getConnectionAdded().getId1(),
                    command.getConnectionAdded().getId2())
            );
            requestAnimationFrame(updateCanvas);
            break;
        case pathfinding_pb.ToClientCommand.CommandCase.CONNECTION_REMOVED:
            connections = connections.filter((connection) => {
                return !(connection.from_id == command.getConnectionRemoved().getId1() &&
                         connection.to_id == command.getConnectionRemoved().getId2());
            });
            requestAnimationFrame(updateCanvas);
            break;
        case pathfinding_pb.ToClientCommand.CommandCase.PATH_RESULT:
            const path_nodes = command.getPathResult().getNodesList();

            connections.forEach((connection) => {
                connection.active = false;
            });

            nodes.forEach((node) => {
                const path_index = path_nodes.findIndex((path_id) => { return path_id == node.id; });
                if (path_index == -1) {
                    node.active = false;
                    return;
                }

                node.active = true;

                if (path_index == 0) {
                    return;
                }

                const previous_in_path_id = path_nodes[path_index - 1];

                connections.forEach((connection) => {
                    if (connection.from_id == previous_in_path_id && connection.to_id == node.id) {
                        connection.active = true;
                    }
                });
            });
            requestAnimationFrame(updateCanvas);
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

function sendFindPath(algorithm) {
    if (path_start_node_id == -1 || path_goal_node_id == -1) {
        return;
    }

    if (ws.readyState != ws.OPEN) {
        console.log("tried to send a message through socket while it wasn't open");
        return;
    }

    let command = new pathfinding_pb.ToServerCommand();

    let find_path = new pathfinding_path_pb.FindPath();
    find_path.setStart(path_start_node_id);
    find_path.setGoal(path_goal_node_id);
    find_path.setAlgorithm(algorithm);

    command.setFindPath(find_path);

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
    let canvas_context = canvas.getContext("2d");

    canvas_context.clearRect(0, 0, canvas.width, canvas.height);

    //canvasContext.fillStyle = "white";
    //canvasContext.fillRect(0, 0, canvas.width, canvas.height);
}

function drawGrid() {
    let canvas = document.getElementById("mainCanvas");
    let canvas_context = canvas.getContext("2d");

    canvas_context.lineWidth = GRID_LINE_WIDTH_PX;
    canvas_context.strokeStyle = "black";

    let canvas_width = canvas_context.canvas.width;
    let canvas_height = canvas_context.canvas.height;

    let grid_lines_x = canvas_width / GRID_SPACING_X_PX;
    let grid_lines_y = canvas_height / GRID_SPACING_X_PX;

    let grid_offset_x = camera_position_x % GRID_SPACING_X_PX;
    let grid_offset_y = camera_position_y % GRID_SPACING_Y_PX;

    canvas_context.beginPath();

    for (let x = 0; x < grid_lines_x + 1; x++) {
        canvas_context.moveTo(x * GRID_SPACING_X_PX + grid_offset_x, 0);
        canvas_context.lineTo(x * GRID_SPACING_X_PX + grid_offset_x, canvas_height);
        canvas_context.stroke();
    }
    for (let y = 0; y < grid_lines_y + 1; y++) {
        canvas_context.moveTo(0, y * GRID_SPACING_Y_PX + grid_offset_y);
        canvas_context.lineTo(canvas_width, y * GRID_SPACING_Y_PX + grid_offset_y);
        canvas_context.stroke();
    }
}

function drawNodes() {
    let canvas = document.getElementById("mainCanvas");
    let canvasContext = canvas.getContext("2d");

    canvasContext.lineWidth = NODE_BORDER_WIDTH_PX;
    canvasContext.strokeStyle = "#000";

    nodes.forEach((node) => {
        let world_x = node.x + camera_position_x;
        let world_y = node.y + camera_position_y;

        canvasContext.beginPath();

        canvasContext.arc(world_x, world_y, NODE_SIZE_PX, 0, 2 * Math.PI);
        canvasContext.fillStyle = node.active ? NODE_PATH_FILL_COLOR : NODE_FILL_COLOR;

        if (node.id == selected_node_id) {
            canvasContext.fillStyle = node.active ? NODE_PATH_SELECTED_FILL_COLOR : NODE_SELECTED_FILL_COLOR;
        }
        else if (node.id == hovered_node_id) {
            canvasContext.fillStyle = node.active ? NODE_PATH_HOVERED_FILL_COLOR : NODE_HOVERED_FILL_COLOR;
        }

        canvasContext.fill();

        canvasContext.stroke();

        canvasContext.font = NODE_NUMBER_FONT;
        canvasContext.textAlign = "center";
        canvasContext.textBaseline = "middle";
        canvasContext.fillStyle = NODE_NUMBER_COLOR;

        canvasContext.fillText(node.id.toString(), world_x, world_y);
    });
}

function drawConnections() {
    let canvas = document.getElementById("mainCanvas");
    let canvasContext = canvas.getContext("2d");

    canvasContext.lineWidth = CONNECTION_WIDTH_PX;

    connections.forEach((connection) => {
        let node_1 = getNodeFromId(connection.from_id);
        let node_2 = getNodeFromId(connection.to_id);

        if (node_1 == -1 || node_2 == -1) {
            console.log("drawConnections: connection has invalid node id");
            return;
        }

        let node_1_x = node_1.x + camera_position_x;
        let node_1_y = node_1.y + camera_position_y;

        let node_2_x = node_2.x + camera_position_x;
        let node_2_y = node_2.y + camera_position_y;

        let angle = Math.atan2(node_2_y - node_1_y, node_2_x - node_1_x);

        let arrow_start_x = node_1_x + NODE_SIZE_PX * Math.cos(angle);
        let arrow_start_y = node_1_y + NODE_SIZE_PX * Math.sin(angle);

        let arrow_end_x = node_2_x - NODE_SIZE_PX * Math.cos(angle);
        let arrow_end_y = node_2_y - NODE_SIZE_PX * Math.sin(angle);

        if (connection.active) {
            canvasContext.strokeStyle = CONNECTION_PATH_COLOR;
        }
        else {
            canvasContext.strokeStyle = CONNECTION_COLOR;
        }

        canvasContext.beginPath();

        canvasContext.moveTo(arrow_start_x, arrow_start_y);
        canvasContext.lineTo(arrow_end_x, arrow_end_y);
        canvasContext.stroke();

        canvasContext.moveTo(arrow_end_x, arrow_end_y);
        canvasContext.lineTo(arrow_end_x - CONNECTION_ARROW_LENGTH_PX * Math.cos(angle - CONNECTION_ARROW_ANGLE_RAD),
                             arrow_end_y - CONNECTION_ARROW_LENGTH_PX * Math.sin(angle - CONNECTION_ARROW_ANGLE_RAD));

        canvasContext.stroke();

        canvasContext.moveTo(arrow_end_x, arrow_end_y);
        canvasContext.lineTo(arrow_end_x - CONNECTION_ARROW_LENGTH_PX * Math.cos(angle + CONNECTION_ARROW_ANGLE_RAD),
                             arrow_end_y - CONNECTION_ARROW_LENGTH_PX * Math.sin(angle + CONNECTION_ARROW_ANGLE_RAD));
        canvasContext.stroke();
    });

}

function updateCanvas() {
    clearCanvas();
    drawGrid();
    drawNodes();
    drawConnections();
}

function processMouseMove(x, y) {
    let relative_move_x = previous_mouse_x - x;
    let relative_move_y = previous_mouse_y - y;

    previous_mouse_x = x;
    previous_mouse_y = y;

    if (dragging_camera) {
        camera_position_x -= relative_move_x;
        camera_position_y -= relative_move_y;

        requestAnimationFrame(updateCanvas);
    }

    mouse_world_x = x - camera_position_x;
    mouse_world_y = y - camera_position_y;

    let previous_hovered_node_id = hovered_node_id;
    hovered_node_id = -1;

    nodes.forEach((node) => {
        var delta_x = node.x - mouse_world_x;
        var delta_y = node.y - mouse_world_y;
        var distance_to_cursor = Math.sqrt(delta_x * delta_x + delta_y * delta_y);

        if (distance_to_cursor < NODE_SIZE_PX) {
            hovered_node_id = node.id;
        }
    });

    if (previous_hovered_node_id != hovered_node_id) {
        requestAnimationFrame(updateCanvas);
    }
}

function updateMainCanvasSize() {
    let canvas = document.getElementById("mainCanvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    requestAnimationFrame(updateCanvas);
}

document.getElementById("mainCanvas").onmousedown = function(event) {
    switch (event.button) {
        case 1: // middle mouse button
            dragging_camera = true;
            break;
    }
}

document.getElementById("mainCanvas").onmouseup = function(event) {
    switch (event.button) {
        case 1: // middle mouse button
            dragging_camera = false;
            break;
    }
}

document.getElementById("mainCanvas").onclick = function(event) {
    const canvas = document.getElementById("mainCanvas");

    const x = mouse_world_x;
    const y = mouse_world_y;

    switch (current_tool) {
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
            if (selected_node_id == -1) {
                selected_node_id = hovered_node_id;
            } else {
                sendAddConnection(selected_node_id, hovered_node_id);
                selected_node_id = -1;
            }
            requestAnimationFrame(updateCanvas);
            break;
        case ToolRemoveConnection:
            if (hovered_node_id == -1) {
                break;
            }
            if (selected_node_id == -1) {
                selected_node_id = hovered_node_id;
            } else {
                sendRemoveConnection(selected_node_id, hovered_node_id);
                selected_node_id = -1;
            }
            requestAnimationFrame(updateCanvas);
            break;
        case ToolSetStart:
            if (hovered_node_id == -1) {
                break;
            }
            path_start_node_id = hovered_node_id;
            break;
        case ToolSetGoal:
            if (hovered_node_id == -1) {
                break;
            }
            path_goal_node_id = hovered_node_id;
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
    current_tool = ToolAddNode;
}

document.getElementById("removeNodeButton").onclick = function() {
    current_tool = ToolRemoveNode;
}

document.getElementById("addConnectionButton").onclick = function() {
    current_tool = ToolAddConnection;
}

document.getElementById("removeConnectionButton").onclick = function() {
    current_tool = ToolRemoveConnection;
}

document.getElementById("setStartButton").onclick = function() {
    current_tool = ToolSetStart;
}

document.getElementById("setGoalButton").onclick = function() {
    current_tool = ToolSetGoal;
}

document.getElementById("findPath").onclick = function () {
    sendFindPath(0);
}

window.addEventListener("resize", function() {
    updateMainCanvasSize();
});

updateMainCanvasSize();