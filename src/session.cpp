#include "session.h"

#include <libpathfinding/src/pathfinder.h>

#include <boost/asio/error.hpp>
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

  if (error == boost::asio::error::eof ||
      error == boost::asio::error::shut_down ||
      error == boost::beast::websocket::error::closed) {
    return;
  }

  if (error) {
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
      ProcessRemoveNode(toserver_cmd.remove_node().id());
      break;
    case ToServerCommand::CommandCase::kAddConnection:
      ProcessAddConnection(toserver_cmd.add_connection().id1(),
                           toserver_cmd.add_connection().id2());
      break;
    case ToServerCommand::CommandCase::kRemoveConnection:
      ProcessRemoveConnection(toserver_cmd.remove_connection().id1(),
                              toserver_cmd.remove_connection().id2());
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
  auto new_node = std::make_unique<PathfinderNode>(x, y);
  auto new_node_ptr = m_pathfinder.AddNode(std::move(new_node));

  const auto new_node_id = [&]() {
    auto first_unused = uint32_t{};
    std::for_each(std::cbegin(m_pathfinder_nodes),
                  std::cend(m_pathfinder_nodes),
                  [&first_unused](const auto& id_node) {
                    const auto& [id, node] = id_node;
                    if (id == first_unused) {
                      first_unused++;
                    } else {
                      return;
                    }
                  });
    return first_unused;
  }();

  m_pathfinder_nodes.insert(std::make_pair(new_node_id, new_node_ptr));

  auto toclient_cmd = ToClientCommand{};
  auto node_added_cmd = new NodeAdded{};  // NOLINT: protobuf owns, not us
  node_added_cmd->set_x(x);
  node_added_cmd->set_y(y);
  node_added_cmd->set_id(new_node_id);
  toclient_cmd.set_allocated_node_added(node_added_cmd);

  m_out_buffers.push_back(toclient_cmd.SerializeAsString());
}

void Session::ProcessRemoveNode(const uint32_t id) noexcept {
  const auto node_iter = m_pathfinder_nodes.find(id);
  if (node_iter == std::end(m_pathfinder_nodes)) {
    fmt::print("Session::ProcessRemoveNode: received an invalid id\n");
    return;
  }

  const auto [node_id, node] = *node_iter;
  m_pathfinder.RemoveNode(node);
  m_pathfinder_nodes.erase(node_iter);

  auto toclient_cmd = ToClientCommand{};
  auto node_removed_cmd = new NodeRemoved{};  // NOLINT: protobuf owns, not us
  node_removed_cmd->set_id(node_id);
  toclient_cmd.set_allocated_node_removed(node_removed_cmd);

  m_out_buffers.push_back(toclient_cmd.SerializeAsString());
}

void Session::ProcessAddConnection(const uint32_t id1, const uint32_t id2) {
  const auto node_1_iter = m_pathfinder_nodes.find(id1);
  if (node_1_iter == std::end(m_pathfinder_nodes)) {
    fmt::print("Session::ProcessAddConnection: received an invalid id\n");
    return;
  }

  const auto node_2_iter = m_pathfinder_nodes.find(id2);
  if (node_2_iter == std::end(m_pathfinder_nodes)) {
    fmt::print("Session::ProcessAddConnection: received an invalid id\n");
    return;
  }

  auto [node_1_id, node_1] = *node_1_iter;
  auto [node_2_id, node_2] = *node_2_iter;

  node_1->AddConnection(node_2);

  auto toclient_cmd = ToClientCommand{};
  auto connection_added_cmd =  // NOLINT: protobuf owns, not us
      new ConnectionAdded{};   //
  connection_added_cmd->set_id1(node_1_id);
  connection_added_cmd->set_id2(node_2_id);
  toclient_cmd.set_allocated_connection_added(connection_added_cmd);

  m_out_buffers.push_back(toclient_cmd.SerializeAsString());
}

void Session::ProcessRemoveConnection(const uint32_t id1, const uint32_t id2) {
  const auto node_1_iter = m_pathfinder_nodes.find(id1);
  if (node_1_iter == std::end(m_pathfinder_nodes)) {
    fmt::print("Session::ProcessAddConnection: received an invalid id\n");
    return;
  }

  const auto node_2_iter = m_pathfinder_nodes.find(id2);
  if (node_2_iter == std::end(m_pathfinder_nodes)) {
    fmt::print("Session::ProcessAddConnection: received an invalid id\n");
    return;
  }

  auto [node_1_id, node_1] = *node_1_iter;
  auto [node_2_id, node_2] = *node_2_iter;

  node_1->RemoveConnection(node_2);

  auto toclient_cmd = ToClientCommand{};
  auto connection_removed_cmd =
      new ConnectionRemoved{};  // NOLINT: protobuf owns, not us
  connection_removed_cmd->set_id1(node_1_id);
  connection_removed_cmd->set_id2(node_2_id);
  toclient_cmd.set_allocated_connection_removed(connection_removed_cmd);

  m_out_buffers.push_back(toclient_cmd.SerializeAsString());
}

};  // namespace Pathfinding
