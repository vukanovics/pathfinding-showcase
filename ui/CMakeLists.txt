add_custom_command(
    OUTPUT pathfinding-proto.js
    COMMAND protoc --proto_path=${CMAKE_SOURCE_DIR}/proto --js_out=import_style=commonjs,binary:${CMAKE_CURRENT_SOURCE_DIR}
        pathfinding_connection.proto
        pathfinding_node.proto
        pathfinding_path.proto
        pathfinding.proto
)

add_custom_command(
    OUTPUT static/bundle.js
    COMMAND browserify ${CMAKE_CURRENT_SOURCE_DIR}/main.js > ${CMAKE_CURRENT_SOURCE_DIR}/static/bundle.js
    DEPENDS
        pathfinding-proto.js
)

add_custom_target(
    pathfinding-ui ALL

    DEPENDS
        static/bundle.js
)