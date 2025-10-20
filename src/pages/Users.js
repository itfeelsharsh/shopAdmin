import { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { motion } from "framer-motion";
import {
  User, Mail, Phone, Search,
  Download, Eye, UserX, CheckCircle, Calendar, LogIn, Chrome,
  ExternalLink, Package, ShoppingBag, Slash
} from "react-feather";
import { Modal, Button, Card, LoadingSpinner, Badge, Input } from "../components/ui";
import { toast } from "react-toastify";
import { formatCurrency } from "../utils/formatUtils";

/**
 * Enhanced Users Management Page with Professional Features
 */
const Users = () => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedUser, setSelectedUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("view"); // view, profilePic, orders
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    banned: 0,
    newThisMonth: 0
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    filterAndSortUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, searchTerm, sortBy, sortOrder, filterStatus]);

  /**
   * Fetch all users with enhanced data
   */
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const usersCol = collection(db, "users");
      const userSnapshot = await getDocs(usersCol);
      const userList = await Promise.all(
        userSnapshot.docs.map(async (userDoc) => {
          const userData = { id: userDoc.id, ...userDoc.data() };

          // Fetch user's orders
          const ordersCol = collection(db, "orders");
          const ordersSnapshot = await getDocs(ordersCol);
          const userOrders = ordersSnapshot.docs
            .map(orderDoc => ({ id: orderDoc.id, ...orderDoc.data() }))
            .filter(order => order.userId === userDoc.id);

          // Calculate user metrics
          const totalSpent = userOrders.reduce((sum, order) => sum + (order.total || 0), 0);
          const orderCount = userOrders.length;

          return {
            ...userData,
            orders: userOrders,
            totalSpent,
            orderCount,
            averageOrderValue: orderCount > 0 ? totalSpent / orderCount : 0
          };
        })
      );

      setUsers(userList);

      // Calculate stats
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const newUsers = userList.filter(user =>
        user.createdAt && new Date(user.createdAt.seconds * 1000) >= firstDayOfMonth
      );
      const bannedUsers = userList.filter(user => user.isBanned);

      setStats({
        total: userList.length,
        active: userList.length - bannedUsers.length,
        banned: bannedUsers.length,
        newThisMonth: newUsers.length
      });
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Filter and sort users
   */
  const filterAndSortUsers = () => {
    let filtered = [...users];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.phone?.includes(searchTerm)
      );
    }

    // Apply status filter
    if (filterStatus === "active") {
      filtered = filtered.filter(user => !user.isBanned);
    } else if (filterStatus === "banned") {
      filtered = filtered.filter(user => user.isBanned);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal, bVal;

      switch (sortBy) {
        case "name":
          aVal = a.name?.toLowerCase() || "";
          bVal = b.name?.toLowerCase() || "";
          break;
        case "email":
          aVal = a.email?.toLowerCase() || "";
          bVal = b.email?.toLowerCase() || "";
          break;
        case "orders":
          aVal = a.orderCount || 0;
          bVal = b.orderCount || 0;
          break;
        case "spent":
          aVal = a.totalSpent || 0;
          bVal = b.totalSpent || 0;
          break;
        case "created":
          aVal = a.createdAt?.seconds || 0;
          bVal = b.createdAt?.seconds || 0;
          break;
        case "lastLogin":
          aVal = a.lastLogin?.seconds || 0;
          bVal = b.lastLogin?.seconds || 0;
          break;
        default:
          aVal = a.name || "";
          bVal = b.name || "";
      }

      if (sortOrder === "asc") {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    setFilteredUsers(filtered);
  };

  /**
   * Toggle ban/unban user
   */
  const toggleBanUser = async (userId, isBanned) => {
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, { isBanned: !isBanned });

      setUsers(users.map(user =>
        user.id === userId ? { ...user, isBanned: !isBanned } : user
      ));

      toast.success(`User ${!isBanned ? "banned" : "unbanned"} successfully`);
    } catch (error) {
      console.error("Error updating user status:", error);
      toast.error("Failed to update user status");
    }
  };

  /**
   * View user details
   */
  const viewUserDetails = (user) => {
    setSelectedUser(user);
    setModalMode("view");
    setIsModalOpen(true);
  };

  /**
   * View profile picture
   */
  const viewProfilePic = (user) => {
    setSelectedUser(user);
    setModalMode("profilePic");
    setIsModalOpen(true);
  };

  /**
   * View user orders
   */
  const viewUserOrders = (user) => {
    setSelectedUser(user);
    setModalMode("orders");
    setIsModalOpen(true);
  };

  /**
   * Export users to CSV
   */
  const exportToCSV = () => {
    const headers = ["Name", "Email", "Phone", "Orders", "Total Spent", "Status", "Created At"];
    const rows = filteredUsers.map(user => [
      user.name || "",
      user.email || "",
      user.phone || "",
      user.orderCount || 0,
      user.totalSpent || 0,
      user.isBanned ? "Banned" : "Active",
      user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleDateString() : ""
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast.success("Users exported successfully!");
  };

  /**
   * Format date
   */
  const formatDate = (timestamp) => {
    if (!timestamp) return "Never";
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  /**
   * Get provider icon
   */
  const getProviderIcon = (provider) => {
    switch (provider) {
      case "google":
        return <Chrome className="w-4 h-4" />;
      default:
        return <Mail className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <LoadingSpinner size="xl" text="Loading users..." />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card gradient>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Users</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-2">{stats.total}</h3>
              </div>
              <div className="bg-blue-100 p-4 rounded-xl">
                <User className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card gradient>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Active Users</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-2">{stats.active}</h3>
              </div>
              <div className="bg-green-100 p-4 rounded-xl">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card gradient>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Banned Users</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-2">{stats.banned}</h3>
              </div>
              <div className="bg-red-100 p-4 rounded-xl">
                <Slash className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card gradient>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">New This Month</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-2">{stats.newThisMonth}</h3>
              </div>
              <div className="bg-purple-100 p-4 rounded-xl">
                <Calendar className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Filters and Search */}
      <Card>
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex-1 w-full md:w-auto">
            <Input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={<Search className="w-5 h-5" />}
              iconPosition="left"
              className="mb-0"
            />
          </div>

          <div className="flex gap-3 w-full md:w-auto">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="name">Name</option>
              <option value="email">Email</option>
              <option value="orders">Orders</option>
              <option value="spent">Total Spent</option>
              <option value="created">Created Date</option>
              <option value="lastLogin">Last Login</option>
            </select>

            <button
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {sortOrder === "asc" ? "↑" : "↓"}
            </button>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="banned">Banned</option>
            </select>

            <Button
              variant="outline"
              onClick={exportToCSV}
              icon={<Download className="w-4 h-4" />}
            >
              Export
            </Button>
          </div>
        </div>
      </Card>

      {/* Users Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Provider
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Orders / Spent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Login
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user, index) => (
                <motion.tr
                  key={user.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * index }}
                  className="hover:bg-gray-50 transition-colors duration-150"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div
                        className="relative cursor-pointer group"
                        onClick={() => user.profilePic && viewProfilePic(user)}
                      >
                        {user.profilePic ? (
                          <img
                            src={user.profilePic}
                            alt={user.name}
                            className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-200 group-hover:ring-blue-500 transition-all duration-200"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                            <span className="text-white font-semibold text-lg">
                              {user.name?.charAt(0) || "?"}
                            </span>
                          </div>
                        )}
                        {user.profilePic && (
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 rounded-full flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100">
                            <Eye className="w-5 h-5 text-white" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{user.name || "Unknown"}</p>
                        <p className="text-sm text-gray-500">ID: {user.id.substring(0, 8)}</p>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail className="w-4 h-4" />
                        {user.email || "N/A"}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="w-4 h-4" />
                        {user.phone || "N/A"}
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge
                      variant="info"
                      icon={getProviderIcon(user.provider)}
                    >
                      {user.provider || "email"}
                    </Badge>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-gray-500" />
                        <span className="font-semibold">{user.orderCount || 0} orders</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-600">{formatCurrency(user.totalSpent || 0)}</span>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <LogIn className="w-4 h-4" />
                      {formatDate(user.lastLogin)}
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant={user.isBanned ? "danger" : "success"}>
                      {user.isBanned ? "Banned" : "Active"}
                    </Badge>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => viewUserDetails(user)}
                        icon={<Eye className="w-4 h-4" />}
                      />
                      <Button
                        size="sm"
                        variant={user.isBanned ? "success" : "danger"}
                        onClick={() => toggleBanUser(user.id, user.isBanned)}
                        icon={user.isBanned ? <CheckCircle className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                      >
                        {user.isBanned ? "Unban" : "Ban"}
                      </Button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No users found</p>
            </div>
          )}
        </div>
      </Card>

      {/* User Details Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          modalMode === "profilePic" ? "Profile Picture" :
          modalMode === "orders" ? "User Orders" :
          "User Details"
        }
        size={modalMode === "orders" ? "lg" : "md"}
      >
        {selectedUser && modalMode === "view" && (
          <div className="space-y-6">
            {/* User Header */}
            <div className="flex items-center gap-4 pb-4 border-b">
              {selectedUser.profilePic ? (
                <img
                  src={selectedUser.profilePic}
                  alt={selectedUser.name}
                  className="w-20 h-20 rounded-full object-cover ring-4 ring-blue-100"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                  <span className="text-white font-bold text-2xl">
                    {selectedUser.name?.charAt(0) || "?"}
                  </span>
                </div>
              )}
              <div>
                <h3 className="text-2xl font-bold text-gray-900">{selectedUser.name}</h3>
                <Badge variant={selectedUser.isBanned ? "danger" : "success"}>
                  {selectedUser.isBanned ? "Banned" : "Active"}
                </Badge>
              </div>
            </div>

            {/* User Info Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-sm font-semibold text-gray-600">Email</label>
                <p className="text-gray-900">{selectedUser.email || "N/A"}</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-600">Phone</label>
                <p className="text-gray-900">{selectedUser.phone || "N/A"}</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-600">Provider</label>
                <p className="text-gray-900 capitalize">{selectedUser.provider || "Email"}</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-600">Total Orders</label>
                <p className="text-gray-900">{selectedUser.orderCount || 0}</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-600">Total Spent</label>
                <p className="text-gray-900">{formatCurrency(selectedUser.totalSpent || 0)}</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-600">Avg. Order Value</label>
                <p className="text-gray-900">{formatCurrency(selectedUser.averageOrderValue || 0)}</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-600">Last Login</label>
                <p className="text-gray-900">{formatDate(selectedUser.lastLogin)}</p>
              </div>

              <div className="col-span-2">
                <label className="text-sm font-semibold text-gray-600">Address</label>
                <p className="text-gray-900">
                  {selectedUser.address ? (
                    `${selectedUser.address.line1}, ${selectedUser.address.line2},
                     ${selectedUser.address.city}, ${selectedUser.address.state} - ${selectedUser.address.pin}`
                  ) : "N/A"}
                </p>
              </div>

              <div className="col-span-2">
                <label className="text-sm font-semibold text-gray-600">Registered On</label>
                <p className="text-gray-900">{formatDate(selectedUser.createdAt)}</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t">
              <Button
                variant="outline"
                fullWidth
                onClick={() => viewUserOrders(selectedUser)}
                icon={<ShoppingBag className="w-4 h-4" />}
              >
                View Orders ({selectedUser.orderCount || 0})
              </Button>
              {selectedUser.profilePic && (
                <Button
                  variant="outline"
                  fullWidth
                  onClick={() => viewProfilePic(selectedUser)}
                  icon={<Eye className="w-4 h-4" />}
                >
                  View Profile Picture
                </Button>
              )}
            </div>
          </div>
        )}

        {selectedUser && modalMode === "profilePic" && (
          <div className="flex flex-col items-center gap-4">
            <img
              src={selectedUser.profilePic}
              alt={selectedUser.name}
              className="max-w-full h-auto rounded-xl shadow-lg"
            />
            <a
              href={selectedUser.profilePic}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 flex items-center gap-2"
            >
              Open in new tab <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}

        {selectedUser && modalMode === "orders" && (
          <div className="space-y-4">
            {selectedUser.orders && selectedUser.orders.length > 0 ? (
              selectedUser.orders.map((order) => (
                <div
                  key={order.id}
                  className="p-4 border rounded-lg hover:border-blue-300 transition-colors duration-200"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold">Order #{order.orderId || order.id.substring(0, 8)}</p>
                      <p className="text-sm text-gray-500">{formatDate(order.orderDate)}</p>
                    </div>
                    <Badge
                      variant={
                        order.status === 'Delivered' ? 'success' :
                        order.status === 'Shipped' ? 'purple' :
                        order.status === 'Placed' ? 'warning' :
                        'default'
                      }
                    >
                      {order.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-600">{order.items?.length || 0} items</p>
                    <p className="font-bold text-lg">{formatCurrency(order.total)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                No orders found for this user
              </div>
            )}
          </div>
        )}
      </Modal>
    </motion.div>
  );
};

export default Users;
