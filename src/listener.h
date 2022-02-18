#pragma once

#include <boost/asio/strand.hpp>
#include <boost/beast/core.hpp>
#include <boost/beast/core/bind_handler.hpp>
#include <boost/beast/websocket.hpp>
#include <boost/beast/websocket/stream_base.hpp>
#include <memory>

namespace Pathfinding {
using boost::asio::ip::tcp;
namespace beast = boost::beast;
namespace http = beast::http;
namespace websocket = beast::websocket;
namespace net = beast::net;
class Listener : public std::enable_shared_from_this<Listener> {
 public:
  Listener(net::io_context& io_context, tcp::endpoint endpoint);

  void Run();

 private:
  void DoAccept();
  void OnAccept(beast::error_code error, tcp::socket socket);

  net::io_context& m_io_context;
  tcp::acceptor m_acceptor;
};
};  // namespace Pathfinding
