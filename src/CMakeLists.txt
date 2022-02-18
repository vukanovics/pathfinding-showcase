set(CMAKE_CXX_CLANG_TIDY "clang-tidy;-header-filter=./src/*.h;--extra-arg-before=-std=c++17")

add_executable(
  pathfinding-backend
  listener.cpp
  session.cpp
  main.cpp
)

target_link_libraries(
  pathfinding-backend
  ${CONAN_LIBS}
)
