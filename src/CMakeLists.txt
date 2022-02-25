find_package(Protobuf REQUIRED)

include_directories(${Protobuf_INCLUDE_DIRS})
include_directories(${CMAKE_CURRENT_BINARY_DIR})

protobuf_generate_cpp(
  PROTO_SRCS
  PROTO_HDRS
  ../pathfinding-showcase-proto/pathfinding_node.proto
  ../pathfinding-showcase-proto/pathfinding_connection.proto
  ../pathfinding-showcase-proto/pathfinding_path.proto
  ../pathfinding-showcase-proto/pathfinding.proto
)

set(CMAKE_CXX_CLANG_TIDY "clang-tidy;-header-filter=./src/*.h;--extra-arg-before=-std=c++17")

add_executable(
  pathfinding-backend
  listener.cpp
  session.cpp
  packet.cpp
  main.cpp
  ${PROTO_SRCS}
)

target_link_libraries(
  pathfinding-backend
  ${CONAN_LIBS}
  ${Protobuf_LIBRARIES}
)
