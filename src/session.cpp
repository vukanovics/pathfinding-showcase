#include "session.h"

#include <boost/beast/core/bind_handler.hpp>

namespace Pathfinding {
void Session::Run() {
  net::dispatch(m_web_socket.get_executor(),
                beast::bind_front_handler(&Session::OnRun, shared_from_this()));
}

void Session::OnRun() {
  m_web_socket.set_option(
      websocket::stream_base::timeout::suggested(beast::role_type::server));

  m_web_socket.set_option(
      websocket::stream_base::decorator([](websocket::response_type& res) {
        res.set(http::field::server, std::string("pathfinding-websockets"));
      }));

  m_web_socket.async_accept(
      beast::bind_front_handler(&Session::OnAccept, shared_from_this()));
}

void Session::OnAccept(beast::error_code error) {
  if (error) {
    throw std::runtime_error(
        fmt::format("Session::OnAccept: {}", error.message()));
  }

  DoRead();
}

void Session::DoRead() {
  m_web_socket.async_read(m_buffer, beast::bind_front_handler(
                                        &Session::OnRead, shared_from_this()));
}

void Session::OnRead(beast::error_code error, std::size_t bytes_transferred) {
  boost::ignore_unused(bytes_transferred);

  if (error) {
    throw std::runtime_error(
        fmt::format("Session::OnRead: {}", error.message()));
  }

  m_web_socket.text(m_web_socket.got_text());

  m_web_socket.async_write(
      m_buffer.data(),
      beast::bind_front_handler(&Session::OnWrite, shared_from_this()));
}

void Session::OnWrite(beast::error_code error, std::size_t bytes_transferred) {
  boost::ignore_unused(bytes_transferred);

  if (error) {
    throw std::runtime_error(
        fmt::format("Session::OnWrite: {}", error.message()));
  }

  m_buffer.consume(m_buffer.size());

  DoRead();
}

};  // namespace Pathfinding
