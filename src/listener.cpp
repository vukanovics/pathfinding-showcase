#include "listener.h"

#include <fmt/format.h>

#include <boost/beast/core/bind_handler.hpp>

#include "session.h"

namespace Pathfinding {
Listener::Listener(net::io_context& io_context, tcp::endpoint endpoint)
    : m_io_context(io_context), m_acceptor(io_context) {
  beast::error_code error;

  m_acceptor.open(endpoint.protocol(), error);

  if (error) {
    throw std::runtime_error(fmt::format(
        "Listener::Listener: couldn't open acceptor: {}", error.message()));
  }

  m_acceptor.set_option(net::socket_base::reuse_address(true), error);

  if (error) {
    throw std::runtime_error(fmt::format(
        "Listener::Listener: couldn't set reuse_address: {}", error.message()));
  }

  m_acceptor.bind(endpoint, error);

  if (error) {
    throw std::runtime_error(fmt::format("Listener::Listener: couldn't bind acceptor: {}", error.message()));
  }

  m_acceptor.listen(net::socket_base::max_listen_connections, error);

  if (error) {
    throw std::runtime_error(fmt::format("Listener::Listener: couldn't listen on acceptor: {}", error.message()));
  }
}

void Listener::Run() { DoAccept(); }

void Listener::DoAccept() {
  m_acceptor.async_accept(
      net::make_strand(m_io_context),
      beast::bind_front_handler(&Listener::OnAccept, shared_from_this()));
}

void Listener::OnAccept(beast::error_code error, tcp::socket socket) {
  if (error) {
    throw std::runtime_error(fmt::format("Listener::OnAccept: {}", error.message()));
  }

  std::make_shared<Session>(std::move(socket))->Run();

  DoAccept();
}
};  // namespace Pathfinding
