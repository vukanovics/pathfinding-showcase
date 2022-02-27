find_package(Protobuf REQUIRED)

include_directories(${Protobuf_INCLUDE_DIRS})
include_directories(${CMAKE_CURRENT_BINARY_DIR})
include_directories(${CMAKE_SOURCE_DIR}/libs)

protobuf_generate_cpp(
  PROTO_SRCS
  PROTO_HDRS
  ../proto/pathfinding_node.proto
  ../proto/pathfinding_connection.proto
  ../proto/pathfinding_path.proto
  ../proto/pathfinding.proto
)

set(CMAKE_CXX_CLANG_TIDY "clang-tidy;-header-filter=./src/*.h;--extra-arg-before=-std=c++17")

add_executable(
  pathfinding-backend
  listener.cpp
  session.cpp
  main.cpp
  ${PROTO_SRCS}
)

target_link_libraries(
  pathfinding-backend
  libpathfinding
  ${CONAN_LIBS}
  ${Protobuf_LIBRARIES}
)
