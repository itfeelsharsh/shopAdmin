import { useEffect, useState } from "react";
import { collection, getDocs, deleteDoc, doc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../../firebase";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Grid, List, Plus, Edit, Trash2, Eye, Package,
  TrendingUp, TrendingDown, AlertTriangle, Check, X, Filter,
  Download, RefreshCw, DollarSign, BarChart2, Archive
} from "react-feather";
import { Button, Card, Input, Modal, Badge, Alert, LoadingSpinner } from "../../components/ui";
import { toast } from "react-toastify";
import { formatCurrency } from "../../utils/formatUtils";

/**
 * WORLD-CLASS Product Manager with Professional Features
 * - Bulk Operations (Restock, Add Stock, Edit, Delete)
 * - Out of Stock Alerts
 * - Grid/List View Toggle
 * - Performance Tracking
 * - Advanced Search & Filters
 * - Product Visibility Control
 */
const ProductManager = () => {
  // Data States
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [orderData, setOrderData] = useState({});
  const [loading, setLoading] = useState(true);

  // UI States
  const [viewMode, setViewMode] = useState('grid'); // grid or list
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [filterStatus, setFilterStatus] = useState("all"); // all, instock, outofstock, lowstock
  const [filterPerformance, setFilterPerformance] = useState("all"); // all, good, poor
  const [showFilters, setShowFilters] = useState(false);

  // Modal States
  const [bulkModal, setBulkModal] = useState({ open: false, type: null }); // restock, addstock, delete
  const [bulkQuantity, setBulkQuantity] = useState("");
  const [viewProductModal, setViewProductModal] = useState({ open: false, product: null });
  const [performingBulkOperation, setPerformingBulkOperation] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    inStock: 0,
    outOfStock: 0,
    lowStock: 0,
    totalValue: 0
  });

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    filterAndSortProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, searchTerm, sortBy, sortOrder, filterStatus, filterPerformance, orderData]);

  /**
   * Fetch all products and calculate performance metrics
   */
  const fetchProducts = async () => {
    try {
      setLoading(true);

      // Fetch products
      const productsCol = collection(db, "products");
      const productsSnapshot = await getDocs(productsCol);
      const productsList = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Fetch orders to calculate performance
      const ordersCol = collection(db, "orders");
      const ordersSnapshot = await getDocs(ordersCol);

      // Calculate sales per product
      const salesData = {};
      ordersSnapshot.docs.forEach(orderDoc => {
        const order = orderDoc.data();
        if (order.items && Array.isArray(order.items)) {
          order.items.forEach(item => {
            const productId = item.productId || item.id;
            if (!salesData[productId]) {
              salesData[productId] = {
                totalSales: 0,
                totalRevenue: 0,
                orderCount: 0
              };
            }
            salesData[productId].totalSales += item.quantity || 0;
            salesData[productId].totalRevenue += (item.price * item.quantity) || 0;
            salesData[productId].orderCount += 1;
          });
        }
      });

      setOrderData(salesData);

      // Enhance products with performance data
      const enhancedProducts = productsList.map(product => {
        const sales = salesData[product.id] || { totalSales: 0, totalRevenue: 0, orderCount: 0 };
        const stock = Number(product.stock) || 0;

        return {
          ...product,
          salesData: sales,
          stockStatus: stock === 0 ? 'outofstock' : stock < 10 ? 'lowstock' : 'instock',
          performance: sales.totalSales > 20 ? 'good' : sales.totalSales > 5 ? 'average' : 'poor',
          isVisible: product.showOnHome !== false // Default to visible
        };
      });

      setProducts(enhancedProducts);

      // Calculate stats
      const totalValue = enhancedProducts.reduce((sum, p) => sum + (Number(p.price) * Number(p.stock)), 0);
      setStats({
        total: enhancedProducts.length,
        inStock: enhancedProducts.filter(p => p.stockStatus === 'instock').length,
        outOfStock: enhancedProducts.filter(p => p.stockStatus === 'outofstock').length,
        lowStock: enhancedProducts.filter(p => p.stockStatus === 'lowstock').length,
        totalValue
      });

    } catch (error) {
      console.error("Error fetching products:", error);
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Filter and sort products
   */
  const filterAndSortProducts = () => {
    let filtered = [...products];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.type?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Stock status filter
    if (filterStatus !== "all") {
      filtered = filtered.filter(product => product.stockStatus === filterStatus);
    }

    // Performance filter
    if (filterPerformance !== "all") {
      filtered = filtered.filter(product => product.performance === filterPerformance);
    }

    // Sorting
    filtered.sort((a, b) => {
      let aVal, bVal;

      switch (sortBy) {
        case "name":
          aVal = a.name?.toLowerCase() || "";
          bVal = b.name?.toLowerCase() || "";
          break;
        case "price":
          aVal = Number(a.price) || 0;
          bVal = Number(b.price) || 0;
          break;
        case "stock":
          aVal = Number(a.stock) || 0;
          bVal = Number(b.stock) || 0;
          break;
        case "sales":
          aVal = a.salesData?.totalSales || 0;
          bVal = b.salesData?.totalSales || 0;
          break;
        case "revenue":
          aVal = a.salesData?.totalRevenue || 0;
          bVal = b.salesData?.totalRevenue || 0;
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

    setFilteredProducts(filtered);
  };

  /**
   * Toggle product selection
   */
  const toggleProductSelection = (productId) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  /**
   * Select all filtered products
   */
  const toggleSelectAll = () => {
    if (selectedProducts.length === filteredProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredProducts.map(p => p.id));
    }
  };

  /**
   * Bulk Restock
   */
  const handleBulkRestock = async () => {
    if (!bulkQuantity || selectedProducts.length === 0) {
      toast.error("Please enter quantity and select products");
      return;
    }

    try {
      setPerformingBulkOperation(true);
      const batch = writeBatch(db);

      selectedProducts.forEach(productId => {
        const productRef = doc(db, "products", productId);
        batch.update(productRef, {
          stock: Number(bulkQuantity),
          updatedAt: new Date()
        });
      });

      await batch.commit();

      toast.success(`Restocked ${selectedProducts.length} products!`);
      setBulkModal({ open: false, type: null });
      setBulkQuantity("");
      setSelectedProducts([]);
      fetchProducts();
    } catch (error) {
      console.error("Error restocking:", error);
      toast.error("Failed to restock products");
    } finally {
      setPerformingBulkOperation(false);
    }
  };

  /**
   * Bulk Add Stock
   */
  const handleBulkAddStock = async () => {
    if (!bulkQuantity || selectedProducts.length === 0) {
      toast.error("Please enter quantity and select products");
      return;
    }

    try {
      setPerformingBulkOperation(true);

      for (const productId of selectedProducts) {
        const product = products.find(p => p.id === productId);
        const productRef = doc(db, "products", productId);
        await updateDoc(productRef, {
          stock: Number(product.stock || 0) + Number(bulkQuantity),
          updatedAt: new Date()
        });
      }

      toast.success(`Added ${bulkQuantity} stock to ${selectedProducts.length} products!`);
      setBulkModal({ open: false, type: null });
      setBulkQuantity("");
      setSelectedProducts([]);
      fetchProducts();
    } catch (error) {
      console.error("Error adding stock:", error);
      toast.error("Failed to add stock");
    } finally {
      setPerformingBulkOperation(false);
    }
  };

  /**
   * Bulk Delete
   */
  const handleBulkDelete = async () => {
    if (selectedProducts.length === 0) {
      toast.error("Please select products to delete");
      return;
    }

    try {
      setPerformingBulkOperation(true);

      for (const productId of selectedProducts) {
        await deleteDoc(doc(db, "products", productId));
      }

      toast.success(`Deleted ${selectedProducts.length} products!`);
      setBulkModal({ open: false, type: null });
      setSelectedProducts([]);
      fetchProducts();
    } catch (error) {
      console.error("Error deleting products:", error);
      toast.error("Failed to delete products");
    } finally {
      setPerformingBulkOperation(false);
    }
  };

  /**
   * Toggle product visibility
   */
  const toggleProductVisibility = async (productId, currentVisibility) => {
    try {
      const productRef = doc(db, "products", productId);
      await updateDoc(productRef, {
        showOnHome: !currentVisibility,
        updatedAt: new Date()
      });

      toast.success(currentVisibility ? "Product hidden from homepage" : "Product shown on homepage");
      fetchProducts();
    } catch (error) {
      console.error("Error updating visibility:", error);
      toast.error("Failed to update visibility");
    }
  };

  /**
   * Delete single product
   */
  const handleDeleteProduct = async (productId) => {
    if (!window.confirm("Are you sure you want to delete this product?")) {
      return;
    }

    try {
      await deleteDoc(doc(db, "products", productId));
      toast.success("Product deleted successfully!");
      fetchProducts();
    } catch (error) {
      console.error("Error deleting product:", error);
      toast.error("Failed to delete product");
    }
  };

  /**
   * Export products to CSV
   */
  const exportToCSV = () => {
    const headers = ["Name", "Brand", "Type", "Price", "Stock", "Sales", "Revenue", "Status", "Performance"];
    const rows = filteredProducts.map(p => [
      p.name || "",
      p.brand || "",
      p.type || "",
      p.price || 0,
      p.stock || 0,
      p.salesData?.totalSales || 0,
      p.salesData?.totalRevenue || 0,
      p.stockStatus || "",
      p.performance || ""
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `products_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast.success("Products exported successfully!");
  };

  /**
   * Get performance badge
   */
  const getPerformanceBadge = (product) => {
    if (product.performance === 'good') {
      return <Badge variant="success" icon={<TrendingUp className="w-3 h-3" />}>High Sales</Badge>;
    } else if (product.performance === 'average') {
      return <Badge variant="warning" icon={<BarChart2 className="w-3 h-3" />}>Average</Badge>;
    } else {
      return <Badge variant="danger" icon={<TrendingDown className="w-3 h-3" />}>Low Sales</Badge>;
    }
  };

  /**
   * Get stock badge
   */
  const getStockBadge = (product) => {
    if (product.stockStatus === 'outofstock') {
      return <Badge variant="danger" dot pulse>Out of Stock</Badge>;
    } else if (product.stockStatus === 'lowstock') {
      return <Badge variant="warning" dot pulse>Low Stock</Badge>;
    } else {
      return <Badge variant="success">In Stock</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <LoadingSpinner size="xl" text="Loading products..." />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Out of Stock Alerts */}
      {stats.outOfStock > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Alert
            variant="danger"
            title="Out of Stock Alert!"
            message={`${stats.outOfStock} product${stats.outOfStock > 1 ? 's are' : ' is'} out of stock. Please restock immediately!`}
          />
        </motion.div>
      )}

      {stats.lowStock > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Alert
            variant="warning"
            title="Low Stock Warning"
            message={`${stats.lowStock} product${stats.lowStock > 1 ? 's have' : ' has'} low stock (< 10 units). Consider restocking soon.`}
          />
        </motion.div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card gradient>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Products</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</h3>
              </div>
              <div className="bg-blue-100 p-3 rounded-xl">
                <Package className="w-5 h-5 text-blue-600" />
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
                <p className="text-gray-600 text-sm font-medium">In Stock</p>
                <h3 className="text-2xl font-bold text-green-600 mt-1">{stats.inStock}</h3>
              </div>
              <div className="bg-green-100 p-3 rounded-xl">
                <Check className="w-5 h-5 text-green-600" />
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
                <p className="text-gray-600 text-sm font-medium">Low Stock</p>
                <h3 className="text-2xl font-bold text-yellow-600 mt-1">{stats.lowStock}</h3>
              </div>
              <div className="bg-yellow-100 p-3 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
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
                <p className="text-gray-600 text-sm font-medium">Out of Stock</p>
                <h3 className="text-2xl font-bold text-red-600 mt-1">{stats.outOfStock}</h3>
              </div>
              <div className="bg-red-100 p-3 rounded-xl">
                <X className="w-5 h-5 text-red-600" />
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card gradient>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Value</p>
                <h3 className="text-2xl font-bold text-purple-600 mt-1">{formatCurrency(stats.totalValue)}</h3>
              </div>
              <div className="bg-purple-100 p-3 rounded-xl">
                <DollarSign className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Toolbar */}
      <Card>
        <div className="space-y-4">
          {/* Top Row - Search and Actions */}
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex-1 w-full md:w-auto">
              <Input
                type="text"
                placeholder="Search products by name, brand, or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                icon={<Search className="w-5 h-5" />}
                iconPosition="left"
                className="mb-0"
              />
            </div>

            <div className="flex gap-2 w-full md:w-auto">
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                icon={<Filter className="w-4 h-4" />}
              >
                Filters
              </Button>
              <Button
                variant="outline"
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                icon={viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
              >
                {viewMode === 'grid' ? 'List' : 'Grid'}
              </Button>
              <Button
                variant="outline"
                onClick={exportToCSV}
                icon={<Download className="w-4 h-4" />}
              >
                Export
              </Button>
              <Link to="/products/add">
                <Button icon={<Plus className="w-4 h-4" />}>
                  Add Product
                </Button>
              </Link>
            </div>
          </div>

          {/* Filters Panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t"
              >
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Sort By</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="name">Name</option>
                    <option value="price">Price</option>
                    <option value="stock">Stock</option>
                    <option value="sales">Sales</option>
                    <option value="revenue">Revenue</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Order</label>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="asc">Ascending</option>
                    <option value="desc">Descending</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Stock Status</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All</option>
                    <option value="instock">In Stock</option>
                    <option value="lowstock">Low Stock</option>
                    <option value="outofstock">Out of Stock</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Performance</label>
                  <select
                    value={filterPerformance}
                    onChange={(e) => setFilterPerformance(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All</option>
                    <option value="good">High Sales</option>
                    <option value="average">Average</option>
                    <option value="poor">Low Sales</option>
                  </select>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bulk Actions */}
          {selectedProducts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-wrap gap-2 pt-4 border-t"
            >
              <Badge variant="info" size="lg">
                {selectedProducts.length} product{selectedProducts.length > 1 ? 's' : ''} selected
              </Badge>
              <Button
                size="sm"
                variant="success"
                onClick={() => setBulkModal({ open: true, type: 'restock' })}
                icon={<RefreshCw className="w-4 h-4" />}
              >
                Bulk Restock
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => setBulkModal({ open: true, type: 'addstock' })}
                icon={<Plus className="w-4 h-4" />}
              >
                Add Stock
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => setBulkModal({ open: true, type: 'delete' })}
                icon={<Trash2 className="w-4 h-4" />}
              >
                Delete Selected
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedProducts([])}
              >
                Clear Selection
              </Button>
            </motion.div>
          )}
        </div>
      </Card>

      {/* Products Display */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05 * index }}
              className="relative"
            >
              <Card hoverable className="h-full">
                {/* Selection Checkbox */}
                <div className="absolute top-4 left-4 z-10">
                  <input
                    type="checkbox"
                    checked={selectedProducts.includes(product.id)}
                    onChange={() => toggleProductSelection(product.id)}
                    className="w-5 h-5 cursor-pointer"
                  />
                </div>

                {/* Product Image */}
                <div className="relative h-48 overflow-hidden rounded-t-xl">
                  <img
                    src={product.image || 'https://via.placeholder.com/300x200?text=No+Image'}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.src = 'https://via.placeholder.com/300x200?text=No+Image';
                    }}
                  />

                  {/* Badges Overlay */}
                  <div className="absolute top-2 right-2 flex flex-col gap-2">
                    {getStockBadge(product)}
                    {getPerformanceBadge(product)}
                  </div>

                  {/* Visibility Toggle */}
                  <div className="absolute bottom-2 right-2">
                    <button
                      onClick={() => toggleProductVisibility(product.id, product.isVisible)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        product.isVisible
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-500 text-white'
                      }`}
                    >
                      {product.isVisible ? 'Visible' : 'Hidden'}
                    </button>
                  </div>
                </div>

                {/* Product Info */}
                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="font-bold text-gray-900 truncate" title={product.name}>
                      {product.name}
                    </h3>
                    <p className="text-sm text-gray-500 truncate">{product.brand} • {product.type}</p>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-blue-50 p-2 rounded">
                      <p className="text-xs text-gray-600">Price</p>
                      <p className="font-bold text-blue-600">{formatCurrency(product.price)}</p>
                    </div>
                    <div className="bg-purple-50 p-2 rounded">
                      <p className="text-xs text-gray-600">Stock</p>
                      <p className="font-bold text-purple-600">{product.stock || 0}</p>
                    </div>
                    <div className="bg-green-50 p-2 rounded">
                      <p className="text-xs text-gray-600">Sales</p>
                      <p className="font-bold text-green-600">{product.salesData?.totalSales || 0}</p>
                    </div>
                    <div className="bg-orange-50 p-2 rounded">
                      <p className="text-xs text-gray-600">Revenue</p>
                      <p className="font-bold text-orange-600">{formatCurrency(product.salesData?.totalRevenue || 0)}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      fullWidth
                      onClick={() => setViewProductModal({ open: true, product })}
                      icon={<Eye className="w-4 h-4" />}
                    >
                      View
                    </Button>
                    <Link to={`/products/edit/${product.id}`} className="flex-1">
                      <Button
                        size="sm"
                        variant="primary"
                        fullWidth
                        icon={<Edit className="w-4 h-4" />}
                      >
                        Edit
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleDeleteProduct(product.id)}
                      icon={<Trash2 className="w-4 h-4" />}
                    />
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        // List View
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 cursor-pointer"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sales</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Performance</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Visibility</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProducts.map((product, index) => (
                  <motion.tr
                    key={product.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.03 * index }}
                    className="hover:bg-gray-50"
                  >
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(product.id)}
                        onChange={() => toggleProductSelection(product.id)}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={product.image || 'https://via.placeholder.com/50'}
                          alt={product.name}
                          className="w-12 h-12 rounded object-cover"
                          onError={(e) => {
                            e.target.src = 'https://via.placeholder.com/50';
                          }}
                        />
                        <div>
                          <p className="font-semibold text-gray-900">{product.name}</p>
                          <p className="text-sm text-gray-500">{product.brand} • {product.type}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold">{formatCurrency(product.price)}</td>
                    <td className="px-6 py-4 font-semibold">{product.stock || 0}</td>
                    <td className="px-6 py-4">{product.salesData?.totalSales || 0}</td>
                    <td className="px-6 py-4">{formatCurrency(product.salesData?.totalRevenue || 0)}</td>
                    <td className="px-6 py-4">{getStockBadge(product)}</td>
                    <td className="px-6 py-4">{getPerformanceBadge(product)}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleProductVisibility(product.id, product.isVisible)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          product.isVisible
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {product.isVisible ? 'Visible' : 'Hidden'}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setViewProductModal({ open: true, product })}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        <Link to={`/products/edit/${product.id}`}>
                          <button className="text-green-600 hover:text-green-800">
                            <Edit className="w-5 h-5" />
                          </button>
                        </Link>
                        <button
                          onClick={() => handleDeleteProduct(product.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>

            {filteredProducts.length === 0 && (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No products found</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Bulk Operations Modal */}
      <Modal
        isOpen={bulkModal.open}
        onClose={() => setBulkModal({ open: false, type: null })}
        title={
          bulkModal.type === 'restock' ? 'Bulk Restock' :
          bulkModal.type === 'addstock' ? 'Bulk Add Stock' :
          'Bulk Delete'
        }
        size="md"
      >
        {bulkModal.type === 'delete' ? (
          <div className="space-y-4">
            <Alert
              variant="danger"
              title="Warning"
              message={`Are you sure you want to delete ${selectedProducts.length} product${selectedProducts.length > 1 ? 's' : ''}? This action cannot be undone.`}
            />
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setBulkModal({ open: false, type: null })}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={performingBulkOperation}
                onClick={handleBulkDelete}
                icon={<Trash2 className="w-4 h-4" />}
              >
                {performingBulkOperation ? 'Deleting...' : 'Delete All'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-600">
              {bulkModal.type === 'restock'
                ? `Set stock quantity for ${selectedProducts.length} selected product${selectedProducts.length > 1 ? 's' : ''}`
                : `Add stock to ${selectedProducts.length} selected product${selectedProducts.length > 1 ? 's' : ''}`
              }
            </p>
            <Input
              label="Quantity"
              type="number"
              placeholder="Enter quantity"
              value={bulkQuantity}
              onChange={(e) => setBulkQuantity(e.target.value)}
              required
            />
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setBulkModal({ open: false, type: null })}
              >
                Cancel
              </Button>
              <Button
                variant="success"
                loading={performingBulkOperation}
                onClick={bulkModal.type === 'restock' ? handleBulkRestock : handleBulkAddStock}
                icon={bulkModal.type === 'restock' ? <RefreshCw className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              >
                {performingBulkOperation ? 'Processing...' : bulkModal.type === 'restock' ? 'Restock' : 'Add Stock'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* View Product Modal */}
      <Modal
        isOpen={viewProductModal.open}
        onClose={() => setViewProductModal({ open: false, product: null })}
        title="Product Details"
        size="lg"
      >
        {viewProductModal.product && (
          <div className="space-y-6">
            {/* Product Images */}
            <div className="grid grid-cols-3 gap-4">
              {[viewProductModal.product.image, viewProductModal.product.image2, viewProductModal.product.image3]
                .filter(Boolean)
                .map((img, idx) => (
                  <img
                    key={idx}
                    src={img}
                    alt={`Product ${idx + 1}`}
                    className="w-full h-32 object-cover rounded-lg"
                    onError={(e) => {
                      e.target.src = 'https://via.placeholder.com/200';
                    }}
                  />
                ))}
            </div>

            {/* Product Info Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-gray-600">Name</label>
                <p className="text-gray-900">{viewProductModal.product.name}</p>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-600">Brand</label>
                <p className="text-gray-900">{viewProductModal.product.brand || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-600">Category</label>
                <p className="text-gray-900">{viewProductModal.product.type || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-600">Price</label>
                <p className="text-gray-900">{formatCurrency(viewProductModal.product.price)}</p>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-600">Stock</label>
                <p className="text-gray-900">{viewProductModal.product.stock || 0}</p>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-600">Total Sales</label>
                <p className="text-gray-900">{viewProductModal.product.salesData?.totalSales || 0} units</p>
              </div>
              <div className="col-span-2">
                <label className="text-sm font-semibold text-gray-600">Total Revenue</label>
                <p className="text-gray-900">{formatCurrency(viewProductModal.product.salesData?.totalRevenue || 0)}</p>
              </div>
              <div className="col-span-2">
                <label className="text-sm font-semibold text-gray-600">Description</label>
                <p className="text-gray-900">{viewProductModal.product.description || 'No description'}</p>
              </div>
            </div>

            {/* Status Badges */}
            <div className="flex gap-2">
              {getStockBadge(viewProductModal.product)}
              {getPerformanceBadge(viewProductModal.product)}
              <Badge variant={viewProductModal.product.isVisible ? 'success' : 'default'}>
                {viewProductModal.product.isVisible ? 'Visible on Homepage' : 'Hidden from Homepage'}
              </Badge>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Link to={`/products/edit/${viewProductModal.product.id}`} className="flex-1">
                <Button fullWidth variant="primary" icon={<Edit className="w-4 h-4" />}>
                  Edit Product
                </Button>
              </Link>
              <Button
                variant="outline"
                onClick={() => toggleProductVisibility(viewProductModal.product.id, viewProductModal.product.isVisible)}
                icon={viewProductModal.product.isVisible ? <Archive className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              >
                {viewProductModal.product.isVisible ? 'Hide' : 'Show'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </motion.div>
  );
};

export default ProductManager;
