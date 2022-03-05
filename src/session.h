#pragma once

#include <fmt/format.h>
#include <libpathfinding/src/pathfinder.h>

#include <boost/asio/strand.hpp>
#include <boost/beast/core.hpp>
#include <boost/beast/core/bind_handler.hpp>
#include <boost/beast/websocket.hpp>
#include <map>
#include <memory>
#include <stdexcept>

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

  void DoWrite();

  void OnWrite(beast::error_code error, std::size_t bytes_transferred);

 private:
  void ProcessAddNode(const float x, const float y) noexcept;
  void ProcessRemoveNode(const uint32_t id) noexcept;

  void ProcessAddConnection(const uint32_t id1, const uint32_t id2);
  void ProcessRemoveConnection(const uint32_t id1, const uint32_t id2);

  class PathfinderNode : public Pathfinding::Pathfinder::Node {
   public:
    PathfinderNode(float x, float y) : m_x(x), m_y(y) {}
    [[nodiscard]] auto GetExactCostTo(Node* to) const -> float final {
      const auto to_cast = dynamic_cast<PathfinderNode*>(to);
      if (to_cast == nullptr) {
        throw std::runtime_error(
            "PathfinderNode::GetExactCostTo: to is not a valid PathfinderNode");
      }
      const auto delta_x = to_cast->GetPosition().first - m_x;
      const auto delta_y = to_cast->GetPosition().second - m_y;

      return sqrtf(delta_x * delta_x + delta_y * delta_y);
    };

    [[nodiscard]] auto GetEstimatedCostTo(Node* to) const -> float final {
      return GetExactCostTo(to);
    };

    [[nodiscard]] auto GetPosition() const noexcept -> std::pair<float, float> {
      return std::make_pair(m_x, m_y);
    }

   private:
    float m_x{};
    float m_y{};
  };

  Pathfinding::Pathfinder m_pathfinder;
  std::map<uint32_t, Pathfinder::Node*> m_pathfinder_nodes;

  std::vector<std::string> m_out_buffers;
  beast::flat_buffer m_buffer;
  websocket::stream<beast::tcp_stream> m_web_socket;
};

};  // namespace Pathfinding
