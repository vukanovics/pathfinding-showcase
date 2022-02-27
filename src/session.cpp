#include "session.h"

#include <boost/beast/core/bind_handler.hpp>

#include "pathfinding.pb.h"

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

  m_web_socket.binary(true);

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

  if (error && error != boost::asio::error::eof) {
    throw std::runtime_error(
        fmt::format("Session::OnRead: {}", error.message()));
  }

  auto toserver_cmd = ToServerCommand{};
  toserver_cmd.ParseFromArray(m_buffer.cdata().data(),
                              m_buffer.cdata().size());  // NOLINT
  switch (toserver_cmd.command_case()) {
    case ToServerCommand::CommandCase::COMMAND_NOT_SET:
      fmt::print("Command not set. WTF? \n");
      break;
    case ToServerCommand::CommandCase::kAddNode:
      ProcessAddNode(toserver_cmd.add_node().x(), toserver_cmd.add_node().y());
      break;
    case ToServerCommand::CommandCase::kRemoveNode:
      fmt::print("Remove node received!\n");
      break;
    case ToServerCommand::CommandCase::kAddConnection:
      fmt::print("Add connection received!\n");
      break;
    case ToServerCommand::CommandCase::kRemoveConnection:
      fmt::print("Remove connection received!\n");
      break;
    case ToServerCommand::CommandCase::kFindPath:
      fmt::print("Find path received!\n");
      break;
  }

  m_buffer.consume(m_buffer.size());

  DoWrite();
}

void Session::DoWrite() {
  if (m_out_buffers.empty()) {
    DoRead();
    return;
  }
  const auto& last = m_out_buffers.back();
  m_out_buffers.pop_back();

  m_web_socket.async_write(
      boost::asio::buffer(last),
      beast::bind_front_handler(&Session::OnWrite, shared_from_this()));
}

void Session::OnWrite(beast::error_code error, std::size_t bytes_transferred) {
  boost::ignore_unused(bytes_transferred);

  if (error) {
    throw std::runtime_error(
        fmt::format("Session::OnWrite: {}", error.message()));
  }

  DoRead();
}

void Session::ProcessAddNode(const float x, const float y) noexcept {
  auto toclient_cmd = ToClientCommand{};
  auto node_added_cmd = new NodeAdded{};  // NOLINT: protobuf owns, not us
  node_added_cmd->set_x(x);
  node_added_cmd->set_y(y);
  toclient_cmd.set_allocated_node_added(node_added_cmd);

  m_out_buffers.push_back(toclient_cmd.SerializeAsString());
}

};  // namespace Pathfinding
