#include <boost/asio/ip/tcp.hpp>
#include <boost/beast/core.hpp>
#include <iostream>

#include "listener.h"

using boost::asio::ip::tcp;
namespace beast = boost::beast;
namespace net = beast::net;

int main(int argc, char** argv) {
  boost::ignore_unused(argc);
  boost::ignore_unused(argv);

  auto const address = net::ip::make_address("127.0.0.1");
  auto const port = static_cast<unsigned short>(8888);

  auto const threads = 1;

  net::io_context io_context{threads};

  std::make_shared<Pathfinding::Listener>(io_context,
                                          tcp::endpoint{address, port})
      ->Run();

  io_context.run();

  return 0;
}
