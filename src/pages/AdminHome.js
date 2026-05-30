import { Link, Outlet, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import { collection, getDocs, query, orderBy, limit, getCountFromServer, where } from 'firebase/firestore';
import { db } from "../firebase";
import { formatCurrency, formatSmartIndian } from "../utils/formatUtils";
import { getOrderTotal } from "../utils/orderService";
import {
  Home, Package, Users, ShoppingBag, Tag, Image as ImageIcon,
  Bell, LogOut, TrendingUp, DollarSign, ShoppingCart, Menu, X,
  ChevronRight, Activity, Smartphone, CreditCard
} from "react-feather";
import { LoadingSpinner } from "../components/ui";
import {
  ResponsiveContainer,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';


/**
 * Enhanced Shopify Stat Card
 */
const StatCard = ({ title, value, icon: Icon, color, trend, loading }) => {
  const colorClasses = {
    green: { border: 'border-l-[#008060]', text: 'text-[#008060]', bg: 'bg-[#e6f4ea]' },
    blue: { border: 'border-l-blue-600', text: 'text-blue-600', bg: 'bg-blue-50' },
    purple: { border: 'border-l-indigo-600', text: 'text-indigo-600', bg: 'bg-indigo-50' },
    orange: { border: 'border-l-amber-600', text: 'text-amber-600', bg: 'bg-amber-50' }
  };

  const currentColors = colorClasses[color] || colorClasses.blue;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white rounded-xl border border-gray-200 border-l-4 ${currentColors.border} p-5 shadow-sm hover:shadow transition-all flex items-center justify-between`}
    >
      <div className="flex-1">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
        {loading ? (
          <div className="h-7 w-20 bg-slate-100 animate-pulse rounded mt-2" />
        ) : (
          <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">{value}</h3>
        )}
        {!loading && trend && (
          <div className="flex items-center mt-2 text-xs font-semibold text-[#008060]">
            <TrendingUp className="w-3.5 h-3.5 mr-1" />
            <span>{trend}</span>
          </div>
        )}
      </div>
      <div className={`p-3 rounded-xl ${currentColors.bg}`}>
        <Icon className={`w-5 h-5 ${currentColors.text}`} />
      </div>
    </motion.div>
  );
};

/**
 * Shopify Polaris Style Admin Dashboard Page
 */
const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [orderStats, setOrderStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    monthlyRevenue: 0,
    averageOrderValue: 0,
    recentOrders: []
  });
  const [monthlyRevenue, setMonthlyRevenue] = useState([]);
  const [productPerformance, setProductPerformance] = useState([]);
  const [statusDistribution, setStatusDistribution] = useState([]);
  const [userStats, setUserStats] = useState({
    totalUsers: 0,
    newUsersThisMonth: 0
  });



  const COLORS = ['#008060', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#6B7280'];
  const STATUS_COLORS = {
    "Placed": "#F59E0B",
    "Shipped": "#8B5CF6",
    "Delivered": "#008060",
    "Cancelled": "#EF4444"
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(now.getMonth() - 6);

        // Fetch recent 150 orders (for deep trend analytics) and total user counts in parallel
        // Conserves Firestore daily credits beautifully
        const ordersCol = collection(db, "orders");
        const usersCol = collection(db, "users");
        
        const [ordersSnapshot, totalUsersSnap] = await Promise.all([
          getDocs(query(ordersCol, orderBy("createdAt", "desc"), limit(150))),
          getCountFromServer(usersCol)
        ]);

        const totalUsers = totalUsersSnap.data().count;

        // Try server count for new users this month to be ultra-efficient
        let newUsersThisMonth = 0;
        try {
          const newUsersSnap = await getCountFromServer(query(usersCol, where("createdAt", ">=", firstDayOfMonth.toISOString())));
          newUsersThisMonth = newUsersSnap.data().count;
        } catch (e) {
          console.warn("Falling back to client-side or zero for new users month count", e);
        }

        // Process Orders Data
        let totalRevenue = 0;
        let monthlyRevenueTotal = 0;
        const statusCounts = {};
        const productSales = {};
        const monthlyData = {};

        // Prepopulate last 6 months for chart trends
        for (let i = 0; i < 6; i++) {
          const month = new Date();
          month.setMonth(now.getMonth() - i);
          const monthKey = `${month.getFullYear()}-${month.getMonth() + 1}`;
          const monthName = month.toLocaleString('default', { month: 'short' });
          monthlyData[monthKey] = {
            month: monthName,
            monthNum: month.getMonth(),
            year: month.getFullYear(),
            revenue: 0,
            orders: 0
          };
        }

        const orders = ordersSnapshot.docs.map(doc => {
          const data = doc.data();
          const orderTotal = getOrderTotal(data);
          
          let orderDate = null;
          if (data.createdAt && typeof data.createdAt.toDate === 'function') {
            orderDate = data.createdAt.toDate();
          } else if (data.createdAt) {
            orderDate = new Date(data.createdAt);
          } else if (data.orderDate) {
            orderDate = new Date(data.orderDate);
          } else if (data.timestamp) {
            orderDate = new Date(data.timestamp);
          }
          
          const status = data.status || "Placed";

          // Accumulate Stats
          totalRevenue += orderTotal;
          if (orderDate && orderDate >= firstDayOfMonth) {
            monthlyRevenueTotal += orderTotal;
          }

          // Status Distribution
          if (!statusCounts[status]) {
            statusCounts[status] = { status, count: 0 };
          }
          statusCounts[status].count += 1;

          // Product sales volume
          if (data.items && Array.isArray(data.items)) {
            data.items.forEach(item => {
              if (!productSales[item.name]) {
                productSales[item.name] = { name: item.name, quantity: 0, revenue: 0 };
              }
              productSales[item.name].quantity += item.quantity || 0;
              productSales[item.name].revenue += ((item.price || 0) * (item.quantity || 0)) || 0;
            });
          }

          // Group by Month
          if (orderDate && orderDate >= sixMonthsAgo) {
            const monthKey = `${orderDate.getFullYear()}-${orderDate.getMonth() + 1}`;
            if (monthlyData[monthKey]) {
              monthlyData[monthKey].revenue += orderTotal;
              monthlyData[monthKey].orders += 1;
            }
          }

          return { id: doc.id, ...data, orderDate, total: orderTotal };
        });

        // Format Monthly Array
        const monthlyArray = Object.values(monthlyData).sort((a, b) => {
          return a.year === b.year
            ? a.monthNum - b.monthNum
            : a.year - b.year;
        });

        // Top 5 Products
        const productArray = Object.values(productSales)
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, 5);

        // Recent Orders
        const recentOrders = [...orders]
          .sort((a, b) => (b.orderDate || 0) - (a.orderDate || 0))
          .slice(0, 5);

        setOrderStats({
          totalOrders: orders.length,
          totalRevenue: totalRevenue,
          monthlyRevenue: monthlyRevenueTotal,
          averageOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0,
          recentOrders: recentOrders
        });
        setMonthlyRevenue(monthlyArray);
        setProductPerformance(productArray);
        setStatusDistribution(Object.values(statusCounts));
        setUserStats({
          totalUsers,
          newUsersThisMonth
        });

      } catch (error) {
        console.error("Error fetching dashboard statistics:", error);
        toast.error("Failed to load dashboard metrics");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3.5 shadow-md rounded-xl border border-gray-200 text-xs">
          <p className="font-bold text-slate-800 mb-1.5">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="font-semibold" style={{ color: entry.color }}>
              {entry.name === "Revenue" ? "Revenue: " + formatCurrency(entry.value) : `Orders: ${entry.value}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96 bg-[#f6f6f7]">
        <LoadingSpinner size="xl" text="Analyzing shop aggregates..." />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Welcome Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Overview</h2>
          <p className="text-sm text-slate-500 mt-0.5">Real-time indicators and operational summary of KamiKoto store.</p>
        </div>
        <div className="flex gap-2">
          <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-[#008060] bg-[#e6f4ea] rounded-full border border-emerald-200">
            <span className="w-1.5 h-1.5 bg-[#008060] rounded-full animate-ping" />
            <span>Live Analytics</span>
          </span>
        </div>
      </div>

      {/* Grid Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Transactions"
          value={orderStats.totalOrders}
          icon={ShoppingCart}
          color="blue"
          loading={loading}
        />
        <StatCard
          title="Gross Sales"
          value={formatCurrency(orderStats.totalRevenue)}
          icon={DollarSign}
          color="green"
          trend={orderStats.monthlyRevenue >= 0 ? `+${formatCurrency(orderStats.monthlyRevenue)} this month` : undefined}
          loading={loading}
        />
        <StatCard
          title="AOV (Avg Order)"
          value={formatCurrency(orderStats.averageOrderValue)}
          icon={TrendingUp}
          color="purple"
          loading={loading}
        />
        <StatCard
          title="Customers Count"
          value={userStats.totalUsers}
          icon={Users}
          color="orange"
          trend={userStats.newUsersThisMonth > 0 ? `+${userStats.newUsersThisMonth} new registered` : undefined}
          loading={loading}
        />
      </div>

      {/* Polaris Charting Layout */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Monthly Revenue Chart */}
          <div className="lg:col-span-2">
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-slate-500" />
                <h4 className="font-bold text-slate-900 text-sm">Monthly Revenue Trend</h4>
              </div>
              {monthlyRevenue.length > 0 ? (
                <div className="h-72 w-full text-xs">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={monthlyRevenue}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#008060" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#008060" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" stroke="#94a3b8" />
                      <YAxis
                        tickFormatter={(value) => formatSmartIndian(value)}
                        stroke="#94a3b8"
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        name="Revenue"
                        stroke="#008060"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorRevenue)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400 text-sm">No recent transactions to aggregate.</div>
              )}
            </div>
          </div>

          {/* Status Breakdown */}
          <div>
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm h-full flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <Package className="w-4 h-4 text-slate-500" />
                <h4 className="font-bold text-slate-900 text-sm">Fulfilment Distribution</h4>
              </div>
              {statusDistribution.length > 0 ? (
                <div className="flex-1 flex flex-col justify-center items-center">
                  <div className="h-44 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={3}
                          dataKey="count"
                          nameKey="status"
                        >
                          {statusDistribution.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={STATUS_COLORS[entry.status] || COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Legend list */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 w-full mt-4 text-xs font-semibold text-slate-600">
                    {statusDistribution.map((entry, index) => (
                      <div key={index} className="flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: STATUS_COLORS[entry.status] || COLORS[index % COLORS.length] }}
                        />
                        <span>{entry.status}: {entry.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400 text-sm my-auto">No orders status records found.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Lists split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Best Sellers */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-slate-500" />
            <h4 className="font-bold text-slate-900 text-sm">Best Sellers</h4>
          </div>
          {productPerformance.length > 0 ? (
            <div className="space-y-2.5">
              {productPerformance.map((product, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border border-slate-100 bg-slate-50/50 rounded-xl hover:border-slate-200 hover:bg-slate-50 transition-all duration-150"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#008060] font-bold text-sm flex items-center justify-center border border-emerald-100">
                      <span>{index + 1}</span>
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm leading-snug">{product.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{product.quantity} items purchased</p>
                    </div>
                  </div>
                  <span className="text-sm font-extrabold text-slate-900">
                    {formatCurrency(product.revenue)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 text-sm">No items sales data generated yet.</div>
          )}
        </div>

        {/* Latest Activity orders */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-slate-500" />
              <h4 className="font-bold text-slate-900 text-sm">Recent Orders</h4>
            </div>
            <Link to="/orders" className="text-xs font-bold text-[#008060] hover:text-[#004b35] flex items-center gap-0.5 uppercase tracking-wider">
              <span>View All</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          {orderStats.recentOrders.length > 0 ? (
            <div className="space-y-2.5">
              {orderStats.recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-3 border border-slate-100 bg-slate-50/50 rounded-xl hover:border-slate-200 hover:bg-slate-50 transition-all duration-150"
                >
                  <div>
                    <p className="font-bold text-slate-900 text-sm leading-snug">
                      Order #{order.orderId || order.id.substring(0, 8)}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{order.userName || order.userEmail || "Anonymous"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-extrabold text-slate-900 text-sm">{formatCurrency(order.total)}</p>
                    <span
                      className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase border mt-0.5 ${
                        order.status === 'Delivered' ? 'bg-green-50 text-green-700 border-green-200' :
                        order.status === 'Shipped' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                        order.status === 'Placed' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-red-50 text-red-700 border-red-200'
                      }`}
                    >
                      {order.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 text-sm">No transaction activity logged yet.</div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

/**
 * Shopify Polaris Style Admin Home Layout Shell with Sidebar navigation
 */
const AdminHome = () => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    toast.success("Logged out successfully!");
    window.location.href = "/login";
  };

  const menuItems = [
    { path: "/", icon: Home, label: "Overview" },
    { path: "/orders", icon: ShoppingBag, label: "Orders" },
    { path: "/products", icon: Package, label: "Products" },
    { path: "/users", icon: Users, label: "Customers" },
    { path: "/coupons", icon: Tag, label: "Discount Codes" },
    { path: "/banners", icon: ImageIcon, label: "Store Banners" },
    { path: "/announcements", icon: Bell, label: "Announcements" },
    { path: "/notifications", icon: Smartphone, label: "Push Campaigns" },
    { path: "/payments", icon: CreditCard, label: "Payment Gateway" }
  ];

  const isManageRoute = location.pathname !== '/';

  return (
    <div className="flex h-screen bg-[#f6f6f7] font-sans antialiased text-slate-900">
      {/* Desktop side navigation */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ x: -280, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -280, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            className="hidden lg:flex w-64 bg-[#1a1a1a] text-slate-300 flex-col border-r border-[#262626] relative z-25"
          >
            {/* Header logo */}
            <div className="p-5 border-b border-[#262626] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#008060] rounded-lg flex items-center justify-center border border-emerald-600 shadow-inner">
                  <Package className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-white leading-tight uppercase tracking-wider">KamiKoto</h2>
                  <p className="text-[10px] text-slate-500 font-semibold tracking-widest uppercase">Admin Portal</p>
                </div>
              </div>
            </div>

            {/* Sidebar menu routes */}
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {menuItems.map((item, index) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path ||
                  (item.path !== '/' && location.pathname.startsWith(item.path));

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`
                      flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all duration-150 border-l-4
                      ${isActive
                        ? 'bg-[#262626] text-white border-l-[#008060] shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-[#262626]/40 border-l-transparent'
                      }
                    `}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#008060]' : 'text-slate-500'}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Logout anchor footer */}
            <div className="p-3 border-t border-[#262626]">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-3.5 py-2.5 rounded-lg text-xs font-bold text-rose-400 hover:text-white hover:bg-rose-950/40 border border-rose-900/30 transition-all"
              >
                <LogOut className="w-4 h-4 text-rose-400" />
                <span>Sign Out</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Drawer Slide Navigation */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-xs"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", stiffness: 250, damping: 25 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 w-64 bg-[#1a1a1a] text-slate-300 z-50 flex flex-col border-r border-[#262626] shadow-2xl"
            >
              <div className="p-5 border-b border-[#262626] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#008060] rounded-lg flex items-center justify-center border border-emerald-600">
                    <Package className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold text-white leading-tight uppercase tracking-wider">KamiKoto</h2>
                    <p className="text-[10px] text-slate-500 font-semibold tracking-widest uppercase">Admin</p>
                  </div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-[#262626]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path ||
                    (item.path !== '/' && location.pathname.startsWith(item.path));

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`
                        flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all border-l-4
                        ${isActive
                          ? 'bg-[#262626] text-white border-l-[#008060]'
                          : 'text-slate-400 hover:text-white hover:bg-[#262626]/40 border-l-transparent'
                        }
                      `}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-[#008060]' : 'text-slate-500'}`} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="p-3 border-t border-[#262626]">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-3.5 py-2.5 rounded-lg text-xs font-bold text-rose-400 hover:text-white hover:bg-rose-950/40 border border-rose-900/30 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Panel Frame */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header Navigation bar */}
        <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 hover:bg-slate-100 rounded-lg text-slate-600"
            >
              <Menu className="w-5 h-5" />
            </button>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden lg:block p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-base font-extrabold text-slate-900 tracking-tight leading-snug">
                {menuItems.find(item => item.path === location.pathname || (item.path !== '/' && location.pathname.startsWith(item.path)))?.label || 'Dashboard'}
              </h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5 hidden sm:block">KamiKoto control panel</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="p-2 hover:bg-slate-100 rounded-lg relative text-slate-600">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#008060] rounded-full animate-pulse"></span>
            </button>
          </div>
        </div>

        {/* Dynamic Nested View content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#f6f6f7]">
          {!isManageRoute && location.pathname === "/" ? (
            <AdminDashboard />
          ) : (
            <Outlet />
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminHome;
