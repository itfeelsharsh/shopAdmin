import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  RefreshCw,
  X,
  FileText,
  Users,
  CornerDownLeft,
  Briefcase
} from "react-feather";
import { formatCurrency } from "../utils/formatUtils";
import { LoadingSpinner } from "../components/ui";

const getApiBaseUrl = () => {
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return "http://localhost:3000/api";
  }
  return "https://kamikoto.click/api";
};

const PaymentGatewayData = () => {
  const [activeTab, setActiveTab] = useState("payments");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({ items: [] });
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [stats, setStats] = useState({
    totalPayments: 0,
    successfulPayments: 0,
    totalRefunded: 0,
    activeDisputes: 0,
    successRate: 100
  });

  // Pagination
  const count = 10;
  const [skip, setSkip] = useState(0);

  const tabs = [
    { id: "payments", label: "Payments", icon: CreditCard },
    { id: "orders", label: "Orders", icon: Briefcase },
    { id: "refunds", label: "Refunds", icon: CornerDownLeft },
    { id: "settlements", label: "Settlements", icon: DollarSign },
    { id: "customers", label: "Customers", icon: Users },
    { id: "invoices", label: "Invoices", icon: FileText },
    { id: "disputes", label: "Disputes", icon: AlertTriangle }
  ];

  const fetchStats = useCallback(async () => {
    try {
      const baseUrl = getApiBaseUrl();
      // Fetch a larger sample of payments to calculate aggregate stats
      const response = await fetch(`${baseUrl}/payment-gateway?type=payments&count=50`);
      if (response.ok) {
        const paymentsData = await response.json();
        const payments = paymentsData.items || [];
        
        let totalVal = 0;
        let successCount = 0;
        let refundVal = 0;
        
        payments.forEach(p => {
          if (p.status === "captured") {
            totalVal += (p.amount / 100);
            successCount++;
          }
          if (p.amount_refunded > 0) {
            refundVal += (p.amount_refunded / 100);
          }
        });

        // Fetch disputes count
        let disputesCount = 0;
        const dispResponse = await fetch(`${baseUrl}/payment-gateway?type=disputes&count=10`);
        if (dispResponse.ok) {
          const disputesData = await dispResponse.json();
          disputesCount = (disputesData.items || []).filter(d => d.status === "under_review" || d.status === "lost_to_merch").length;
        }

        setStats({
          totalPayments: totalVal,
          successfulPayments: successCount,
          totalRefunded: refundVal,
          activeDisputes: disputesCount,
          successRate: payments.length > 0 ? Math.round((successCount / payments.length) * 100) : 100
        });
      }
    } catch (e) {
      console.warn("Failed to load statistics: ", e);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(
        `${baseUrl}/payment-gateway?type=${activeTab}&count=${count}&skip=${skip}`
      );
      
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || `Failed to fetch ${activeTab}`);
      }

      const result = await response.json();
      setData(result || { items: [] });
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to communicate with the Razorpay API. Please verify that the Cloudflare Pages Functions backend is running and Razorpay test credentials are configured correctly.");
    } finally {
      setLoading(false);
    }
  }, [activeTab, count, skip]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchData();
    setSelectedItem(null);
  }, [fetchData]);

  const handleNextPage = () => {
    setSkip(prev => prev + count);
  };

  const handlePrevPage = () => {
    setSkip(prev => Math.max(0, prev - count));
  };

  const getFilteredItems = () => {
    const items = data.items || [];
    if (!searchQuery) return items;
    const query = searchQuery.toLowerCase();

    return items.filter(item => {
      // General string matching across typical ID or email fields
      const idMatch = item.id?.toLowerCase().includes(query);
      const emailMatch = item.email?.toLowerCase().includes(query);
      const contactMatch = item.contact?.toLowerCase().includes(query);
      const statusMatch = item.status?.toLowerCase().includes(query);
      return idMatch || emailMatch || contactMatch || statusMatch;
    });
  };

  const filteredItems = getFilteredItems();

  const renderTableHeaders = () => {
    switch (activeTab) {
      case "payments":
        return (
          <>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Payment ID</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Method</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">User Info</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
          </>
        );
      case "orders":
        return (
          <>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Order ID</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Attempts</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Receipt</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
          </>
        );
      case "refunds":
        return (
          <>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Refund ID</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Payment ID</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
          </>
        );
      case "settlements":
        return (
          <>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Settlement ID</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Fees</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Tax</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
          </>
        );
      case "customers":
        return (
          <>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer ID</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
          </>
        );
      case "invoices":
        return (
          <>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Invoice ID</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Billing Name</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
          </>
        );
      case "disputes":
        return (
          <>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Dispute ID</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Payment ID</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Reason</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
          </>
        );
      default:
        return null;
    }
  };

  const renderRow = (item) => {
    const formattedDate = new Date(item.created_at * 1000).toLocaleString();
    const getStatusColor = (status) => {
      const s = status?.toLowerCase();
      if (["captured", "paid", "processed", "won", "active", "completed"].includes(s)) {
        return "bg-green-50 text-green-700 border border-green-200";
      }
      if (["created", "attempted", "issued", "under_review"].includes(s)) {
        return "bg-amber-50 text-amber-700 border border-amber-200";
      }
      return "bg-red-50 text-red-700 border border-red-200";
    };

    switch (activeTab) {
      case "payments":
        return (
          <>
            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">{item.id}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm font-extrabold text-slate-900">{formatCurrency(item.amount / 100)}</td>
            <td className="px-6 py-4 whitespace-nowrap">
              <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(item.status)}`}>
                {item.status}
              </span>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 uppercase font-semibold">{item.method}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
              <div>{item.email || "N/A"}</div>
              <div className="text-xs text-slate-400">{item.contact || "N/A"}</div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{formattedDate}</td>
          </>
        );
      case "orders":
        return (
          <>
            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">{item.id}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm font-extrabold text-slate-900">{formatCurrency(item.amount / 100)}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{item.attempts}</td>
            <td className="px-6 py-4 whitespace-nowrap">
              <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(item.status)}`}>
                {item.status}
              </span>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{item.receipt || "N/A"}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{formattedDate}</td>
          </>
        );
      case "refunds":
        return (
          <>
            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">{item.id}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-600">{item.payment_id}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm font-extrabold text-slate-900">{formatCurrency(item.amount / 100)}</td>
            <td className="px-6 py-4 whitespace-nowrap">
              <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(item.status)}`}>
                {item.status}
              </span>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{formattedDate}</td>
          </>
        );
      case "settlements":
        return (
          <>
            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">{item.id}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm font-extrabold text-slate-900">{formatCurrency(item.amount / 100)}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{formatCurrency((item.fees || 0) / 100)}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{formatCurrency((item.tax || 0) / 100)}</td>
            <td className="px-6 py-4 whitespace-nowrap">
              <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(item.status)}`}>
                {item.status}
              </span>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{formattedDate}</td>
          </>
        );
      case "customers":
        return (
          <>
            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">{item.id}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-800">{item.name || "N/A"}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.email || "N/A"}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{item.contact || "N/A"}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{formattedDate}</td>
          </>
        );
      case "invoices":
        return (
          <>
            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">{item.id}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm font-extrabold text-slate-900">{formatCurrency(item.amount / 100)}</td>
            <td className="px-6 py-4 whitespace-nowrap">
              <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(item.status)}`}>
                {item.status}
              </span>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.customer_details?.name || "N/A"}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{formattedDate}</td>
          </>
        );
      case "disputes":
        return (
          <>
            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">{item.id}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-600">{item.payment_id}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm font-extrabold text-slate-900">{formatCurrency(item.amount / 100)}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 capitalize">{item.reason?.replace(/_/g, " ")}</td>
            <td className="px-6 py-4 whitespace-nowrap">
              <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(item.status)}`}>
                {item.status}
              </span>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{formattedDate}</td>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-emerald-600 p-5 shadow-sm">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Captured Volume</p>
              <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">{formatCurrency(stats.totalPayments)}</h3>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-blue-600 p-5 shadow-sm">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Success Rate</p>
              <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">{stats.successRate}%</h3>
            </div>
            <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-amber-600 p-5 shadow-sm">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Refunded Volume</p>
              <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">{formatCurrency(stats.totalRefunded)}</h3>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 text-amber-600">
              <CornerDownLeft className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-red-600 p-5 shadow-sm">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Disputes</p>
              <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">{stats.activeDisputes}</h3>
            </div>
            <div className="p-3 rounded-xl bg-red-50 text-red-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs list */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap gap-2 border-b border-gray-150 pb-3">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSkip(0);
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all border ${
                  isActive
                    ? "bg-[#1a1a1a] text-white border-[#1a1a1a]"
                    : "bg-transparent text-slate-600 border-transparent hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search & Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-4">
          <div className="relative w-full sm:w-80">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 w-full text-sm bg-slate-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#008060] focus:border-[#008060]"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                fetchStats();
                fetchData();
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 border border-gray-200 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 rounded-lg"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Table data */}
        <div className="mt-4 overflow-x-auto border border-gray-150 rounded-lg">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <LoadingSpinner size="md" text={`Retrieving ${activeTab}...`} />
            </div>
          ) : error ? (
            <div className="p-8 text-center text-slate-500">
              <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
              <p className="font-bold text-slate-800 text-sm mb-1">Failed to fetch gateway metrics</p>
              <p className="text-xs max-w-lg mx-auto">{error}</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              No matching {activeTab} logs found.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-slate-50">
                <tr>
                  {renderTableHeaders()}
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/55 transition-colors">
                    {renderRow(item)}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold">
                      <button
                        onClick={() => setSelectedItem(item)}
                        className="text-[#008060] hover:text-[#005c44] flex items-center gap-1 ml-auto"
                      >
                        <Eye className="w-4 h-4" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination controls */}
        <div className="flex justify-between items-center mt-4 text-xs font-bold text-slate-600">
          <div>
            Showing <span className="text-slate-800">{filteredItems.length}</span> entries
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevPage}
              disabled={skip === 0 || loading}
              className="p-1.5 border border-gray-200 bg-white hover:bg-slate-50 rounded-lg disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>Skip {skip}</span>
            <button
              onClick={handleNextPage}
              disabled={data.items?.length < count || loading}
              className="p-1.5 border border-gray-200 bg-white hover:bg-slate-50 rounded-lg disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Side Details Drawer */}
      <AnimatePresence>
        {selectedItem && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedItem(null)}
              className="fixed inset-0 bg-black z-40"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-white shadow-2xl z-50 flex flex-col"
            >
              {/* Drawer Header */}
              <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-slate-600" />
                    <span>{selectedItem.id} Details</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                    Razorpay {activeTab.slice(0, -1)} payload inspector
                  </p>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-1.5 hover:bg-gray-200 rounded-lg text-slate-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Key Properties</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(selectedItem)
                      .filter(([_, val]) => typeof val !== "object" && val !== null)
                      .map(([key, val]) => (
                        <div key={key} className="p-3 border border-slate-100 bg-slate-50/50 rounded-lg">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{key.replace(/_/g, " ")}</p>
                          <p className="text-sm font-semibold text-slate-800 break-all mt-0.5">
                            {key.includes("amount") && typeof val === "number"
                              ? formatCurrency(val / 100)
                              : key.includes("created_at") && typeof val === "number"
                              ? new Date(val * 1000).toLocaleString()
                              : String(val)}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Complete Raw Response Payload</h4>
                  <pre className="text-xs font-mono bg-slate-900 text-slate-200 p-4 rounded-xl overflow-x-auto shadow-inner border border-slate-800">
                    {JSON.stringify(selectedItem, null, 2)}
                  </pre>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PaymentGatewayData;
