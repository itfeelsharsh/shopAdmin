import { useEffect, useState, useCallback } from "react";
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  query, 
  orderBy, 
  limit, 
  startAfter, 
  where, 
  getCountFromServer 
} from "firebase/firestore";
import { db } from "../firebase";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Mail, Phone, Search,
  Download, Eye, UserX, CheckCircle, Calendar, LogIn, Chrome,
  ExternalLink, Package, ShoppingBag, Slash, AlertTriangle, ArrowRight
} from "react-feather";
import { Modal, Button, LoadingSpinner, Badge } from "../components/ui";
import { toast } from "react-toastify";
import { formatCurrency } from "../utils/formatUtils";
import { getOrderTotal } from "../utils/orderService";

/**
 * Shopify Polaris Inspired Paginated Users Management Page
 */
const Users = () => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);
  const [processingUser, setProcessingUser] = useState(null); 
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("created");
  const [sortOrder, setSortOrder] = useState("desc");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedUser, setSelectedUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("view"); // view, profilePic, orders
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    disabled: 0,
    newThisMonth: 0
  });

  // Fetch global stats using ultra-cheap server counts (does not consume doc reads)
  const fetchGlobalStats = async () => {
    try {
      const usersCol = collection(db, "users");
      
      const totalSnapshot = await getCountFromServer(usersCol);
      const totalCount = totalSnapshot.data().count;
      
      const disabledQuery = query(usersCol, where("isBanned", "==", true));
      const disabledSnapshot = await getCountFromServer(disabledQuery);
      const disabledCount = disabledSnapshot.data().count;
      
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const newQuery = query(usersCol, where("createdAt", ">=", firstDayOfMonth.toISOString()));
      
      let newCount = 0;
      try {
        const newSnapshot = await getCountFromServer(newQuery);
        newCount = newSnapshot.data().count;
      } catch (e) {
        console.warn("Could not fetch new users server count (missing index), skipping", e);
      }
      
      setStats({
        total: totalCount,
        active: totalCount - disabledCount,
        disabled: disabledCount,
        newThisMonth: newCount
      });
    } catch (error) {
      console.error("Error fetching global stats:", error);
    }
  };

  // Main fetch function - paginated & highly optimized
  const fetchUsers = async (isLoadMore = false) => {
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    
    try {
      let usersQuery;
      const usersCol = collection(db, "users");
      
      if (searchTerm.trim() !== "") {
        // Fetch up to 100 users for active search to search client-side safely & conserve credits
        usersQuery = query(usersCol, orderBy("createdAt", "desc"), limit(100));
        setHasMore(false);
      } else {
        if (isLoadMore && lastVisible) {
          usersQuery = query(usersCol, orderBy("createdAt", "desc"), startAfter(lastVisible), limit(15));
        } else {
          usersQuery = query(usersCol, orderBy("createdAt", "desc"), limit(15));
        }
      }
      
      const userSnapshot = await getDocs(usersQuery);
      const rawUsers = userSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (rawUsers.length > 0) {
        // Fetch orders ONLY for these retrieved users - reduces reads by 99%
        const userIds = rawUsers.map(u => u.id).filter(Boolean);
        let allOrders = [];
        
        if (userIds.length > 0) {
          const ordersCol = collection(db, "orders");
          // Chunk to handle Firestore 'in' limit of 30 items
          const chunks = [];
          for (let i = 0; i < userIds.length; i += 30) {
            chunks.push(userIds.slice(i, i + 30));
          }
          
          for (const chunk of chunks) {
            const ordersQuery = query(ordersCol, where("userId", "in", chunk));
            const ordersSnapshot = await getDocs(ordersQuery);
            allOrders = [...allOrders, ...ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))];
          }
        }
        
        // Map orders to their respective user profiles
        const ordersByUserMap = new Map();
        allOrders.forEach(order => {
          const uId = order.userId;
          if (uId) {
            if (!ordersByUserMap.has(uId)) {
              ordersByUserMap.set(uId, []);
            }
            ordersByUserMap.get(uId).push(order);
          }
        });
        
        // Map user profiles with computed aggregate metrics and fallbacks
        const processedUsers = rawUsers.map(userData => {
          const userOrders = ordersByUserMap.get(userData.id) || [];
          
          // Sort orders newest first
          const sortedOrders = [...userOrders].sort((a, b) => {
            const dateA = a.orderDate ? new Date(a.orderDate) : (a.createdAt ? new Date(a.createdAt.seconds * 1000) : new Date(0));
            const dateB = b.orderDate ? new Date(b.orderDate) : (b.createdAt ? new Date(b.createdAt.seconds * 1000) : new Date(0));
            return dateB - dateA;
          });
          
          const totalSpent = userOrders.reduce((sum, order) => {
            return sum + getOrderTotal(order);
          }, 0);
          
          const orderCount = userOrders.length;
          const averageOrderValue = orderCount > 0 ? totalSpent / orderCount : 0;
          
          // 1. Registered On Fallback Chain: doc createdAt -> earliest order date
          const registeredOn = userData.createdAt || (sortedOrders.length > 0 ? sortedOrders[sortedOrders.length - 1].createdAt || sortedOrders[sortedOrders.length - 1].orderDate : null);
          
          // 2. Last Login Fallback Chain: doc lastLogin -> doc createdAt -> latest order date
          const lastLogin = userData.lastLogin || userData.createdAt || (sortedOrders.length > 0 ? sortedOrders[0].createdAt || sortedOrders[0].orderDate : null);
          
          // 3. Address Fallback Chain: doc address -> latest order shipping address
          let address = userData.address || null;
          if (!address && sortedOrders.length > 0) {
            const orderWithAddress = sortedOrders.find(o => o.shipping?.address || o.shippingAddress);
            if (orderWithAddress) {
              const addr = orderWithAddress.shipping?.address || orderWithAddress.shippingAddress;
              address = {
                line1: addr.line1 || addr.street || "",
                line2: addr.line2 || "",
                city: addr.city || "",
                state: addr.state || "",
                pin: addr.pin || addr.zip || "",
                country: addr.country || "",
                houseNo: addr.houseNo || ""
              };
            }
          }
          
          let profilePic = userData.profilePic;
          const cdnDomain = process.env.REACT_APP_CDN_DOMAIN || 'cdn.kamikoto.click';
          if (profilePic === "https://admin.kamikoto.click/static/media/defaultpfp.d4a4059e1339afff7575.png" || 
              profilePic === "/static/media/defaultpfp.d4a4059e1339afff7575.png" ||
              profilePic === `https://${cdnDomain}/static/media/defaultpfp.d4a4059e1339afff7575.png`) {
            profilePic = `https://${cdnDomain}/uploads/2026-05/7iab5ffy-3423.jpeg`;
          }

          return {
            ...userData,
            profilePic,
            orders: sortedOrders,
            totalSpent,
            orderCount,
            averageOrderValue,
            createdAt: registeredOn,
            lastLogin,
            address
          };
        });
        
        if (isLoadMore) {
          setUsers(prev => {
            const existingIds = new Set(prev.map(u => u.id));
            const freshOnes = processedUsers.filter(u => !existingIds.has(u.id));
            return [...prev, ...freshOnes];
          });
        } else {
          setUsers(processedUsers);
        }
        
        if (searchTerm.trim() === "") {
          setLastVisible(userSnapshot.docs[userSnapshot.docs.length - 1]);
          setHasMore(userSnapshot.docs.length === 15);
        }
      } else {
        if (!isLoadMore) {
          setUsers([]);
        }
        setHasMore(false);
      }
      
      // Load global counts
      if (!isLoadMore) {
        fetchGlobalStats();
      }
      
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Debounced search trigger
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchUsers();
    }, 400);

    return () => clearTimeout(delayDebounceFn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const filterAndSortUsers = useCallback(() => {
    let filtered = [...users];

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(user =>
        user.name?.toLowerCase().includes(search) ||
        user.email?.toLowerCase().includes(search) ||
        user.phone?.includes(search)
      );
    }

    // Status filter
    if (filterStatus === "active") {
      filtered = filtered.filter(user => !user.isBanned);
    } else if (filterStatus === "disabled") {
      filtered = filtered.filter(user => user.isBanned);
    }

    // Sort operations
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
          aVal = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          bVal = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          break;
        case "lastLogin":
          aVal = a.lastLogin ? new Date(a.lastLogin).getTime() : 0;
          bVal = b.lastLogin ? new Date(b.lastLogin).getTime() : 0;
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
  }, [users, searchTerm, sortBy, sortOrder, filterStatus]);

  useEffect(() => {
    filterAndSortUsers();
  }, [filterAndSortUsers]);

  // Disable / Enable Account workflow
  const toggleUserStatus = async (userId, isBanned) => {
    try {
      setProcessingAction(true);
      setProcessingUser(userId);
      
      const confirmAction = window.confirm(
        `Are you sure you want to ${!isBanned ? "DISABLE" : "ENABLE"} this user account?\n\n` +
        `This will ${!isBanned ? "block" : "restore"} their login and shopping access across the storefront.`
      );
      
      if (!confirmAction) {
        setProcessingAction(false);
        setProcessingUser(null);
        return;
      }
      
      // Enforce the professional 2-second processing guard
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, { isBanned: !isBanned });

      setUsers(users.map(user =>
        user.id === userId ? { ...user, isBanned: !isBanned } : user
      ));

      toast.success(`Account successfully ${!isBanned ? "disabled" : "enabled"}`);
      fetchGlobalStats();
    } catch (error) {
      console.error("Error updating user status:", error);
      toast.error("Failed to update account status");
    } finally {
      setProcessingAction(false);
      setProcessingUser(null);
    }
  };

  const viewUserDetails = (user) => {
    setSelectedUser(user);
    setModalMode("view");
    setIsModalOpen(true);
  };

  const viewProfilePic = (user) => {
    setSelectedUser(user);
    setModalMode("profilePic");
    setIsModalOpen(true);
  };

  const viewUserOrders = (user) => {
    setSelectedUser(user);
    setModalMode("orders");
    setIsModalOpen(true);
  };

  const exportToCSV = () => {
    const headers = ["Name", "Email", "Phone", "Orders", "Total Spent", "Status", "Registered On"];
    const rows = filteredUsers.map(user => [
      user.name || "",
      user.email || "",
      user.phone || "",
      user.orderCount || 0,
      user.totalSpent || 0,
      user.isBanned ? "Disabled" : "Active",
      user.createdAt ? new Date(user.createdAt).toLocaleDateString() : ""
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customers_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast.success("Customers exported successfully!");
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "Never";
    let date;
    if (timestamp.seconds !== undefined && timestamp.seconds !== null) {
      date = new Date(timestamp.seconds * 1000);
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp.toDate === 'function') {
      date = timestamp.toDate();
    } else {
      date = new Date(timestamp);
    }
    
    if (isNaN(date.getTime())) {
      return "Never";
    }
    
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }) + " " + date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getProviderIcon = (provider) => {
    switch (provider) {
      case "google":
        return <Chrome className="w-3 h-3 text-[#4285F4]" />;
      default:
        return <Mail className="w-3 h-3 text-slate-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-[#f6f6f7]">
        <LoadingSpinner size="xl" text="Retrieving customer records..." />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 p-4 sm:p-6 bg-[#f6f6f7] min-h-screen"
    >
      {/* Title Header */}
      <div className="flex justify-between items-center pb-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Customers</h1>
          <p className="text-sm text-slate-500 mt-1">Manage, verify, and view customer shopping metrics.</p>
        </div>
      </div>

      {/* Polaris Grid Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Customers", value: stats.total, color: "border-l-blue-500", iconBg: "bg-blue-50", icon: <User className="w-5 h-5 text-blue-600" /> },
          { label: "Active Customers", value: stats.active, color: "border-l-green-500", iconBg: "bg-green-50", icon: <CheckCircle className="w-5 h-5 text-green-600" /> },
          { label: "Disabled Accounts", value: stats.disabled, color: "border-l-red-500", iconBg: "bg-red-50", icon: <Slash className="w-5 h-5 text-red-600" /> },
          { label: "New This Month", value: stats.newThisMonth, color: "border-l-purple-500", iconBg: "bg-purple-50", icon: <Calendar className="w-5 h-5 text-purple-600" /> }
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            className={`bg-white border border-gray-200 border-l-4 ${stat.color} rounded-xl p-5 shadow-sm flex items-center justify-between`}
          >
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{stat.label}</p>
              <h3 className="text-2xl font-bold text-slate-950 mt-1">{stat.value}</h3>
            </div>
            <div className={`p-3 rounded-xl ${stat.iconBg}`}>{stat.icon}</div>
          </motion.div>
        ))}
      </div>

      {/* Filters and Search Strip */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="w-full lg:flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email, or phone number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008060] focus:border-[#008060] placeholder-slate-400 bg-slate-50"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 w-full lg:w-auto items-center justify-end">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008060] bg-white text-slate-700"
          >
            <option value="created">Registered On</option>
            <option value="name">Name</option>
            <option value="email">Email</option>
            <option value="orders">Orders Count</option>
            <option value="spent">Total Spent</option>
            <option value="lastLogin">Last Active</option>
          </select>

          <button
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            className="p-1.5 border border-gray-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50"
          >
            {sortOrder === "asc" ? "↑" : "↓"}
          </button>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008060] bg-white text-slate-700"
          >
            <option value="all">All Accounts</option>
            <option value="active">Active Only</option>
            <option value="disabled">Disabled Only</option>
          </select>

          <Button
            variant="outline"
            onClick={exportToCSV}
            icon={<Download className="w-4 h-4" />}
            className="border-gray-200 hover:bg-slate-50 text-slate-700 text-sm py-1.5"
          >
            Export List
          </Button>
        </div>
      </div>

      {/* Polaris Table Container */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {filteredUsers.length === 0 ? (
          <div className="text-center py-16 bg-white">
            <AlertTriangle className="w-10 h-10 text-slate-300 mx-auto mb-3 animate-pulse" />
            <p className="text-slate-500 font-semibold text-base">No customers found</p>
            <p className="text-slate-400 text-xs mt-1">Try updating your filters or searching another keyword.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-[#f9fafb]">
                  <tr>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Contact info
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Auth Method
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Orders & Value
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Last Login
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Account Status
                    </th>
                    <th className="px-6 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <AnimatePresence>
                    {filteredUsers.map((user) => (
                      <motion.tr
                        key={user.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="hover:bg-slate-50 transition-colors duration-150"
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
                                  className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-100 group-hover:ring-[#008060] transition-all duration-200"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                                  <span className="text-slate-700 font-bold text-sm">
                                    {user.name?.charAt(0).toUpperCase() || "?"}
                                  </span>
                                </div>
                              )}
                              {user.profilePic && (
                                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                  <Eye className="w-4 h-4 text-white" />
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 leading-snug">{user.name || "Anonymous User"}</p>
                              <p className="text-xs text-slate-400">ID: {user.id.substring(0, 8)}</p>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5 text-xs">
                              <Mail className="w-3.5 h-3.5 text-slate-400" />
                              <span>{user.email || "N/A"}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              <span>{user.phone || "N/A"}</span>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge
                            variant="neutral"
                            icon={getProviderIcon(user.provider)}
                            className="bg-slate-100 text-slate-700 border border-slate-200 text-xs px-2 py-0.5 rounded-full capitalize flex items-center gap-1"
                          >
                            {user.provider || "email"}
                          </Badge>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1 text-xs text-slate-700">
                              <Package className="w-3.5 h-3.5 text-slate-400" />
                              <span className="font-semibold">{user.orderCount || 0} orders</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-slate-500">
                              <ShoppingBag className="w-3.5 h-3.5 text-slate-400" />
                              <span>Spent: {formatCurrency(user.totalSpent || 0)}</span>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                          <div className="flex items-center gap-1.5">
                            <LogIn className="w-3.5 h-3.5 text-slate-400" />
                            <span>{formatDate(user.lastLogin)}</span>
                          </div>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${
                              user.isBanned
                                ? "bg-red-50 text-red-700 border-red-200"
                                : "bg-green-50 text-green-700 border-green-200"
                            }`}
                          >
                            {user.isBanned ? "Disabled" : "Active"}
                          </span>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => viewUserDetails(user)}
                              icon={<Eye className="w-4 h-4 text-slate-600" />}
                              className="border-gray-200 hover:bg-slate-50 py-1"
                            />
                            <button
                              onClick={() => toggleUserStatus(user.id, user.isBanned)}
                              disabled={processingAction}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-200 ${
                                user.isBanned
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                  : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                              } disabled:opacity-50`}
                            >
                              {processingUser === user.id ? (
                                <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              ) : user.isBanned ? (
                                <CheckCircle className="w-3.5 h-3.5" />
                              ) : (
                                <UserX className="w-3.5 h-3.5" />
                              )}
                              <span className="hidden sm:inline">
                                {processingUser === user.id
                                  ? "Processing..."
                                  : user.isBanned
                                  ? "Enable Account"
                                  : "Disable Account"}
                              </span>
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="block md:hidden divide-y divide-slate-100 bg-white">
              <AnimatePresence>
                {filteredUsers.map((user) => (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="p-4 space-y-3"
                  >
                    {/* Top Profile block */}
                    <div className="flex items-center gap-3">
                      <div
                        className="relative cursor-pointer group shrink-0"
                        onClick={() => user.profilePic && viewProfilePic(user)}
                      >
                        {user.profilePic ? (
                          <img
                            src={user.profilePic}
                            alt={user.name}
                            className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-100"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                            <span className="text-slate-700 font-bold text-sm">
                              {user.name?.charAt(0).toUpperCase() || "?"}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 text-sm leading-snug truncate">
                          {user.name || "Anonymous User"}
                        </p>
                        <p className="text-[10px] text-slate-400">ID: {user.id.substring(0, 8)}</p>
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          user.isBanned
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-green-50 text-green-700 border-green-200"
                        }`}
                      >
                        {user.isBanned ? "Disabled" : "Active"}
                      </span>
                    </div>

                    {/* Contact & Auth details */}
                    <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50/50 border border-slate-100 rounded-xl p-3">
                      <div className="space-y-1">
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Contact</p>
                        <div className="flex items-center gap-1.5 text-slate-600 truncate">
                          <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{user.email || "N/A"}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-600 truncate">
                          <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{user.phone || "N/A"}</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Auth & Login</p>
                        <div className="flex items-center gap-1">
                          <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[9px] font-bold px-1.5 py-0.2 rounded capitalize">
                            {user.provider || "email"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-500 truncate">
                          <LogIn className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{formatDate(user.lastLogin)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Stats & Actions */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex flex-col text-xs text-slate-500 font-medium">
                        <span>
                          Orders: <strong className="text-slate-800">{user.orderCount || 0}</strong>
                        </span>
                        <span>
                          Spent: <strong className="text-slate-800">{formatCurrency(user.totalSpent || 0)}</strong>
                        </span>
                      </div>
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => viewUserDetails(user)}
                          icon={<Eye className="w-3.5 h-3.5 text-slate-600" />}
                          className="border-gray-200 hover:bg-slate-50 py-1 px-2.5 text-xs"
                        >
                          View Details
                        </Button>
                        <button
                          onClick={() => toggleUserStatus(user.id, user.isBanned)}
                          disabled={processingAction}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all duration-200 ${
                            user.isBanned
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                              : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                          } disabled:opacity-50`}
                        >
                          {processingUser === user.id ? (
                            <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : user.isBanned ? (
                            <CheckCircle className="w-3 h-3" />
                          ) : (
                            <UserX className="w-3 h-3" />
                          )}
                          <span>{user.isBanned ? "Enable" : "Disable"}</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>

      {/* Pagination Load More Strip */}
      {hasMore && searchTerm.trim() === "" && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => fetchUsers(true)}
            disabled={loadingMore}
            className="flex items-center gap-2 px-6 py-2.5 bg-white border border-gray-200 hover:bg-slate-50 font-bold text-slate-700 text-xs uppercase tracking-wider rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-60"
          >
            {loadingMore ? (
              <>
                <span className="w-4 h-4 border-2 border-slate-700 border-t-transparent rounded-full animate-spin" />
                <span>Loading next chunk...</span>
              </>
            ) : (
              <>
                <span>Load More Customers</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      )}

      {/* High Fidelity Details Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          modalMode === "profilePic" ? "Profile Picture" :
          modalMode === "orders" ? "Shopping History" :
          "Customer Profile"
        }
        size={modalMode === "orders" ? "lg" : "md"}
      >
        {selectedUser && modalMode === "view" && (
          <div className="space-y-5 text-slate-700">
            {/* Header Badge Card */}
            <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
              {selectedUser.profilePic ? (
                <img
                  src={selectedUser.profilePic}
                  alt={selectedUser.name}
                  className="w-16 h-16 rounded-full object-cover ring-4 ring-slate-100"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                  <span className="text-slate-700 font-bold text-2xl">
                    {selectedUser.name?.charAt(0).toUpperCase() || "?"}
                  </span>
                </div>
              )}
              <div>
                <h3 className="text-xl font-bold text-slate-900 leading-tight">{selectedUser.name || "Anonymous User"}</h3>
                <div className="flex items-center gap-2 mt-1.5">
                  <span
                    className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${
                      selectedUser.isBanned
                        ? "bg-red-50 text-red-700 border-red-200"
                        : "bg-green-50 text-green-700 border-green-200"
                    }`}
                  >
                    {selectedUser.isBanned ? "Disabled Account" : "Active Account"}
                  </span>
                  <Badge variant="neutral" className="capitalize text-xs bg-slate-100 text-slate-600 border border-slate-200">
                    {selectedUser.provider || "Email"}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Structured Metric Blocks */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Email Address</label>
                <p className="text-sm font-semibold text-slate-900 mt-1 break-all">{selectedUser.email || "N/A"}</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Phone number</label>
                <p className="text-sm font-semibold text-slate-900 mt-1">{selectedUser.phone || "N/A"}</p>
              </div>

              <div className="col-span-2 grid grid-cols-3 gap-2 py-3 bg-slate-50 rounded-xl px-4 border border-slate-100">
                <div className="text-center">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Total Orders</label>
                  <p className="text-base font-bold text-slate-950 mt-1">{selectedUser.orderCount || 0}</p>
                </div>
                <div className="text-center border-x border-slate-200">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Total Spent</label>
                  <p className="text-base font-bold text-slate-950 mt-1">{formatCurrency(selectedUser.totalSpent || 0)}</p>
                </div>
                <div className="text-center">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Avg. Order</label>
                  <p className="text-base font-bold text-slate-950 mt-1">{formatCurrency(selectedUser.averageOrderValue || 0)}</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Last Login</label>
                <p className="text-sm font-semibold text-slate-900 mt-1">{formatDate(selectedUser.lastLogin)}</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Registered On</label>
                <p className="text-sm font-semibold text-slate-900 mt-1">{formatDate(selectedUser.createdAt)}</p>
              </div>

              <div className="col-span-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Address Details</label>
                <p className="text-sm font-semibold text-slate-950 mt-1 bg-slate-50 border border-slate-100 p-3 rounded-lg leading-relaxed">
                  {selectedUser.address ? (
                    <>
                      {selectedUser.address.houseNo && `${selectedUser.address.houseNo}, `}
                      {selectedUser.address.line1 && `${selectedUser.address.line1}, `}
                      {selectedUser.address.line2 && `${selectedUser.address.line2}, `}
                      {selectedUser.address.city && `${selectedUser.address.city}, `}
                      {selectedUser.address.state && `${selectedUser.address.state} `}
                      {selectedUser.address.pin && `- ${selectedUser.address.pin}, `}
                      {selectedUser.address.country && `${selectedUser.address.country}`}
                    </>
                  ) : (
                    <span className="text-slate-400 italic">No address on file (profile or orders)</span>
                  )}
                </p>
              </div>
            </div>

            {/* Bottom Actions Drawer */}
            <div className="flex gap-2 pt-4 border-t border-slate-100">
              <Button
                variant="outline"
                fullWidth
                onClick={() => viewUserOrders(selectedUser)}
                icon={<ShoppingBag className="w-4 h-4 text-slate-600" />}
                className="py-2.5 font-bold text-slate-700 text-xs border-gray-200"
              >
                Shopping History ({selectedUser.orderCount || 0})
              </Button>
              {selectedUser.profilePic && (
                <Button
                  variant="outline"
                  fullWidth
                  onClick={() => viewProfilePic(selectedUser)}
                  icon={<Eye className="w-4 h-4 text-slate-600" />}
                  className="py-2.5 font-bold text-slate-700 text-xs border-gray-200"
                >
                  View Large Photo
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Profile Pic Zoom Modal */}
        {selectedUser && modalMode === "profilePic" && (
          <div className="flex flex-col items-center gap-3">
            <img
              src={selectedUser.profilePic}
              alt={selectedUser.name}
              className="max-w-full h-auto rounded-xl shadow-lg border border-slate-100"
            />
            <a
              href={selectedUser.profilePic}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1.5 uppercase tracking-wider mt-2"
            >
              <span>Download / Open Image</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {/* Orders History List inside Modal */}
        {selectedUser && modalMode === "orders" && (
          <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
            {selectedUser.orders && selectedUser.orders.length > 0 ? (
              selectedUser.orders.map((order) => (
                <div
                  key={order.id}
                  className="p-4 border border-slate-200 rounded-xl hover:border-emerald-500 bg-white hover:shadow-sm transition-all duration-200 flex flex-col sm:flex-row justify-between sm:items-center gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-900 text-sm">Order #{order.orderId || order.id.substring(0, 8)}</p>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                          order.status === 'Delivered' ? 'bg-green-50 text-green-700 border-green-200' :
                          order.status === 'Shipped' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                          order.status === 'Placed' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{formatDate(order.orderDate)}</p>
                    <p className="text-xs text-slate-500 mt-1 font-semibold">{order.items?.length || 0} items purchased</p>
                  </div>
                  <div className="text-left sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 flex sm:flex-col justify-between items-center sm:items-end">
                    <span className="text-xs font-semibold text-slate-400 sm:hidden">Total Amount:</span>
                    <span className="font-extrabold text-slate-900 text-lg">{formatCurrency(order.total)}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 bg-slate-50 border border-slate-100 rounded-xl">
                <ShoppingBag className="w-8 h-8 text-slate-300 mx-auto mb-2 animate-pulse" />
                <p className="text-slate-500 font-semibold text-sm">No shopping history</p>
                <p className="text-slate-400 text-xs mt-0.5">This customer has not placed any orders yet.</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </motion.div>
  );
};

export default Users;
