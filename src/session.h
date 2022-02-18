#pragma once

#include <fmt/format.h>

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

class Session : public std::enable_shared_from_this<Session> {
 public:
  explicit Session(tcp::socket&& socket) : m_web_socket(std::move(socket)) {}

  void Run();

  void OnRun();

  void OnAccept(beast::error_code error);

  void DoRead();

  void OnRead(beast::error_code error, std::size_t bytes_transferred);

  void OnWrite(beast::error_code error, std::size_t bytes_transferred);

 private:
  beast::flat_buffer m_buffer;
  websocket::stream<beast::tcp_stream> m_web_socket;
};

};  // namespace Pathfinding
