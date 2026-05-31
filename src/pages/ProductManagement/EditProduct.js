import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { db, getAppCheckToken } from "../../firebase";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Package, DollarSign, Image as ImageIcon, Tag, Info, Check,
  X, Plus, Trash2, Globe, Shield, Save
} from "react-feather";
import { Button, Card, Input, Alert, Badge, LoadingSpinner } from "../../components/ui";
import { toast } from "react-toastify";
import { sendBroadcastNotification } from "../../utils/notificationService";
import { processFileItem, uploadToCDN } from "../../utils/uploadHelper";

const productTypes = [
  'Notebooks and Journals', 'Pens and Pencils', 'Paper and Notepads',
  'Planners and Calendars', 'Office Supplies', 'Art Supplies',
  'Desk Accessories', 'Cards and Envelopes', 'Writing Accessories',
  'Gift Wrap and Packaging',
];

const brands = [
  'Camel', 'Faber-Castell', 'Staedtler', 'Doms', 'Camlin', 'Luxor',
  'Monami', 'Schneider', 'Pentel', 'Pilot', 'Kokuyo', 'Nataraj',
  'OHPen', 'Bic', 'Zebra', 'Stabilo',
];

/**
 * Enhanced Edit Product Page with Modern UI
 */
const EditProduct = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('basic');
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState(null);

  // Custom brand states
  const [dynamicBrands, setDynamicBrands] = useState([]);
  const [isCreatingBrand, setIsCreatingBrand] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [isCreatingBrandSubmitting, setIsCreatingBrandSubmitting] = useState(false);

  // Custom category states
  const [dynamicCategories, setDynamicCategories] = useState([]);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isCreatingCategorySubmitting, setIsCreatingCategorySubmitting] = useState(false);
  
  // Custom upload states
  const [dragActive, setDragActive] = useState(false);
  const [uploadQueue, setUploadQueue] = useState([]);
  const [imageSourceTab, setImageSourceTab] = useState("file");
  const [urlsText, setUrlsText] = useState("");
  const [isFetchingUrls, setIsFetchingUrls] = useState(false);

  useEffect(() => {
    // Fetch dynamic brands and categories from settings docs
    const fetchSettings = async () => {
      try {
        const brandsRef = doc(db, "settings", "brands");
        const brandsSnap = await getDoc(brandsRef);
        if (brandsSnap.exists() && brandsSnap.data().brands) {
          setDynamicBrands(brandsSnap.data().brands);
        }

        const categoriesRef = doc(db, "settings", "categories");
        const categoriesSnap = await getDoc(categoriesRef);
        if (categoriesSnap.exists() && categoriesSnap.data().categories) {
          setDynamicCategories(categoriesSnap.data().categories);
        }
      } catch (err) {
        console.error("Error fetching dynamic settings:", err);
      }
    };
    fetchSettings();
  }, []);

  const handleCreateCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      toast.error("Please enter a category name");
      return;
    }
    
    const allCategories = [...new Set([...productTypes, ...dynamicCategories])].sort();
    if (allCategories.includes(trimmed)) {
      toast.error("Category already exists");
      return;
    }
    
    setIsCreatingCategorySubmitting(true);
    try {
      const docRef = doc(db, "settings", "categories");
      const docSnap = await getDoc(docRef);
      let list = [];
      if (docSnap.exists()) {
        list = docSnap.data().categories || [];
      }
      
      if (!list.includes(trimmed)) {
        list.push(trimmed);
        await setDoc(docRef, { categories: list }, { merge: true });
      }
      
      setDynamicCategories([...dynamicCategories, trimmed]);
      setProduct(prev => ({ ...prev, type: trimmed }));
      setNewCategoryName("");
      setIsCreatingCategory(false);
      toast.success(`Category "${trimmed}" created and selected!`);
    } catch (error) {
      console.error("Error creating category:", error);
      toast.error("Failed to create category");
    } finally {
      setIsCreatingCategorySubmitting(false);
    }
  };

  const handleCreateBrand = async () => {
    const trimmed = newBrandName.trim();
    if (!trimmed) {
      toast.error("Please enter a brand name");
      return;
    }
    
    const allBrands = [...new Set([...brands, ...dynamicBrands])].sort();
    if (allBrands.includes(trimmed)) {
      toast.error("Brand already exists");
      return;
    }
    
    setIsCreatingBrandSubmitting(true);
    try {
      const docRef = doc(db, "settings", "brands");
      const docSnap = await getDoc(docRef);
      let list = [];
      if (docSnap.exists()) {
        list = docSnap.data().brands || [];
      }
      
      if (!list.includes(trimmed)) {
        list.push(trimmed);
        await setDoc(docRef, { brands: list }, { merge: true });
      }
      
      setDynamicBrands([...dynamicBrands, trimmed]);
      setProduct(prev => ({ ...prev, brand: trimmed }));
      setNewBrandName("");
      setIsCreatingBrand(false);
      toast.success(`Brand "${trimmed}" created and selected!`);
    } catch (error) {
      console.error("Error creating brand:", error);
      toast.error("Failed to create brand");
    } finally {
      setIsCreatingBrandSubmitting(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFiles(Array.from(e.target.files));
    }
  };

  const processFiles = async (files) => {
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} is not an image file.`);
        continue;
      }
      
      const fileId = Math.random().toString(36).substring(2, 9) + "-" + Date.now();
      const newQueueItem = { id: fileId, name: file.name, progress: 0, status: "processing", info: "Analyzing..." };
      setUploadQueue(prev => [...prev, newQueueItem]);
      
      try {
        // 1. Client-side smart processing
        const { processedFile, processingStatuses } = await processFileItem(file);
        const infoText = processingStatuses.join(" • ") || "Ready";
        
        setUploadQueue(prev => prev.map(item => item.id === fileId ? { ...item, status: "uploading", info: infoText } : item));
        
        // 2. Upload to CDN
        const cdnUrl = await uploadToCDN(processedFile, (percent) => {
          setUploadQueue(prev => prev.map(item => item.id === fileId ? { ...item, progress: percent } : item));
        });
        
        // 3. Auto-populate product image fields
        setProduct(prev => {
          if (!prev.image) return { ...prev, image: cdnUrl };
          if (!prev.image2) return { ...prev, image2: cdnUrl };
          if (!prev.image3) return { ...prev, image3: cdnUrl };
          return { ...prev, image: cdnUrl }; // fallback to primary if all filled
        });
        
        setUploadQueue(prev => prev.filter(item => item.id !== fileId));
        toast.success(`Uploaded ${file.name} successfully!`);
      } catch (err) {
        console.error("Error uploading file:", err);
        setUploadQueue(prev => prev.map(item => item.id === fileId ? { ...item, status: "error", errorMsg: err.message } : item));
        toast.error(`Failed to upload ${file.name}: ${err.message}`);
      }
    }
  };

  const handleImportUrls = async () => {
    if (!urlsText.trim()) {
      toast.error("Please enter at least one URL");
      return;
    }

    const lines = urlsText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
      
    if (lines.length === 0) {
      toast.error("No valid URLs found");
      return;
    }

    setIsFetchingUrls(true);
    let successCount = 0;

    for (const url of lines) {
      try {
        new URL(url); // syntax validation
        const appCheckToken = await getAppCheckToken();
        const headers = {};
        if (appCheckToken) {
          headers["X-Firebase-AppCheck"] = appCheckToken;
        }

        const apiBase = window.location.hostname === 'localhost' ? 'http://localhost:8788' : '';
        const res = await fetch(`${apiBase}/api/proxy-image?url=${encodeURIComponent(url)}`, { headers });
        
        if (!res.ok) {
          throw new Error(`Proxy fetch returned status ${res.status}`);
        }

        const blob = await res.blob();
        const contentType = res.headers.get("content-type") || blob.type || "application/octet-stream";
        
        let filename = "";
        try {
          const u = new URL(url);
          const pathSegment = u.pathname.split("/").pop();
          filename = pathSegment ? decodeURIComponent(pathSegment) : "";
        } catch {}

        if (!filename) {
          const ext = contentType.split("/")[1] || "jpg";
          filename = `imported-image-${Math.random().toString(36).substring(2, 8)}.${ext}`;
        }

        const file = new File([blob], filename, { type: contentType });
        await processFiles([file]);
        successCount++;
      } catch (err) {
        console.error(`Failed to import URL ${url}:`, err);
        toast.error(`Import failed: ${url.substring(0, 45)}... (${err.message})`);
      }
    }

    setIsFetchingUrls(false);
    setUrlsText("");
    if (successCount > 0) {
      toast.success(`Successfully imported ${successCount} image(s)`);
    }
  };

  const [tagInput, setTagInput] = useState("");
  const [featureInput, setFeatureInput] = useState("");
  const [specKey, setSpecKey] = useState("");
  const [specValue, setSpecValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notifyUsers, setNotifyUsers] = useState(false);

  const tabs = [
    { id: 'basic', label: 'Basic Info', icon: Package },
    { id: 'pricing', label: 'Pricing', icon: DollarSign },
    { id: 'images', label: 'Images', icon: ImageIcon },
    { id: 'details', label: 'Details', icon: Info },
    { id: 'warranty', label: 'Warranty', icon: Shield }
  ];

  useEffect(() => {
    fetchProduct();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const productRef = doc(db, "products", id);
      const productDoc = await getDoc(productRef);

      if (productDoc.exists()) {
        const productData = productDoc.data();
        setProduct({
          ...productData,
          mrp: productData.mrp || productData.price || "",
          sellingPrice: productData.sellingPrice || productData.price || "",
          tags: productData.tags || [],
          features: productData.features || [],
          specifications: productData.specifications || [],
          origin: productData.origin || "",
          warranty: productData.warranty || { available: false, period: "", details: "" },
          guarantee: productData.guarantee || { available: false, period: "", details: "" },
          additionalInfo: productData.additionalInfo || "",
          importDetails: productData.importDetails || { isImported: false, country: "", deliveryNote: "" },
        });
      } else {
        toast.error("Product not found");
        navigate("/products");
      }
    } catch (error) {
      console.error("Error fetching product:", error);
      toast.error("Failed to load product");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProduct = async () => {
    if (!product.name || !product.sellingPrice) {
      toast.error("Please fill in required fields");
      return;
    }

    try {
      setIsSubmitting(true);

      const productRef = doc(db, "products", id);
      
      // Get the original product data to compare changes
      const oldProductDoc = await getDoc(productRef);
      const oldProduct = oldProductDoc.data();
      
      const priceChanged = Number(oldProduct.sellingPrice) !== Number(product.sellingPrice);
      const stockAdded = Number(oldProduct.stock) === 0 && Number(product.stock) > 0;

      const updateData = {
        ...product,
        sellingPrice: Number(product.sellingPrice || product.price),
        mrp: Number(product.mrp || product.price),
        price: Number(product.sellingPrice || product.price),
        stock: Number(product.stock),
        updatedAt: new Date()
      };

      await updateDoc(productRef, updateData);
      
      // Handle notifications
      if (notifyUsers && (priceChanged || stockAdded)) {
        let title = "";
        let body = "";
        
        if (priceChanged && Number(product.sellingPrice) < Number(oldProduct.sellingPrice)) {
          title = "Price Drop Alert! 📉";
          body = `${product.name} is now available at a lower price of ₹${product.sellingPrice}!`;
        } else if (stockAdded) {
          title = "Back in Stock! 📦";
          body = `Great news! ${product.name} is back in stock. Grab yours before it's gone!`;
        }

        if (title) {
          await sendBroadcastNotification({
            title,
            body,
            link: `/product/${id}`,
            type: 'product_update'
          });
          toast.info("Notifications sent to users!");
        }
      }

      toast.success("Product updated successfully!");
      setTimeout(() => {
        navigate("/products");
      }, 1500);
    } catch (error) {
      console.error("Error updating product:", error);
      toast.error("Failed to update product");
    } finally {
      setIsSubmitting(false);
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !product.tags.includes(tagInput.trim())) {
      setProduct({ ...product, tags: [...product.tags, tagInput.trim()] });
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove) => {
    setProduct({ ...product, tags: product.tags.filter(tag => tag !== tagToRemove) });
  };

  const addFeature = () => {
    if (featureInput.trim()) {
      setProduct({ ...product, features: [...product.features, featureInput.trim()] });
      setFeatureInput("");
    }
  };

  const removeFeature = (index) => {
    setProduct({ ...product, features: product.features.filter((_, i) => i !== index) });
  };

  const addSpecification = () => {
    if (specKey.trim() && specValue.trim()) {
      setProduct({
        ...product,
        specifications: [...product.specifications, { key: specKey.trim(), value: specValue.trim() }]
      });
      setSpecKey("");
      setSpecValue("");
    }
  };

  const removeSpecification = (index) => {
    setProduct({ ...product, specifications: product.specifications.filter((_, i) => i !== index) });
  };

  const discountPercentage = () => {
    if (!product) return 0;
    const mrp = Number(product.mrp);
    const selling = Number(product.sellingPrice);
    if (mrp > selling && selling > 0) {
      return Math.round(((mrp - selling) / mrp) * 100);
    }
    return 0;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <LoadingSpinner size="xl" text="Loading product..." />
      </div>
    );
  }

  if (!product) {
    return (
      <Alert variant="danger" title="Product Not Found" message="The product you're looking for doesn't exist." />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-6xl mx-auto space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Edit Product</h1>
          <p className="text-gray-600 mt-1">Update product information for: <span className="font-semibold">{product.name}</span></p>
        </div>
        <Button
          variant="ghost"
          onClick={() => navigate("/products")}
          icon={<X className="w-4 h-4" />}
        >
          Cancel
        </Button>
      </div>

      {/* Progress Indicator */}
      <Card>
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <motion.button
                key={tab.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </motion.button>
            );
          })}
        </div>
      </Card>

      {/* Basic Info Tab */}
      {activeTab === 'basic' && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          <Card title="Basic Information" icon={<Package className="w-5 h-5 text-blue-600" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Product Name"
                placeholder="Enter product name"
                value={product.name}
                onChange={(e) => setProduct({ ...product, name: e.target.value })}
                required
              />

               <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Brand</label>
                <div className="flex gap-2">
                  <select
                    value={product.brand}
                    onChange={(e) => setProduct({ ...product, brand: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Brand</option>
                    {[...new Set([...brands, ...dynamicBrands])].sort().map((brand) => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                </div>
                {isCreatingBrand ? (
                  <div className="mt-2 flex gap-2 items-center">
                    <Input
                      type="text"
                      placeholder="New brand name"
                      value={newBrandName}
                      onChange={(e) => setNewBrandName(e.target.value)}
                      className="mb-0 flex-grow"
                    />
                    <Button
                      type="button"
                      onClick={handleCreateBrand}
                      isLoading={isCreatingBrandSubmitting}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-10 px-3 shrink-0"
                    >
                      Create
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setIsCreatingBrand(false)}
                      variant="ghost"
                      className="text-gray-500 text-xs h-10 px-3 shrink-0"
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsCreatingBrand(true)}
                    className="mt-2 text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 focus:outline-none"
                  >
                    <Plus className="w-3.5 h-3.5" /> Create New Brand
                  </button>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
                <div className="flex gap-2">
                  <select
                    value={product.type}
                    onChange={(e) => setProduct({ ...product, type: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Category</option>
                    {[...new Set([...productTypes, ...dynamicCategories])].sort().map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                {isCreatingCategory ? (
                  <div className="mt-2 flex gap-2 items-center">
                    <Input
                      type="text"
                      placeholder="New category name"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="mb-0 flex-grow"
                    />
                    <Button
                      type="button"
                      onClick={handleCreateCategory}
                      isLoading={isCreatingCategorySubmitting}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-10 px-3 shrink-0"
                    >
                      Create
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setIsCreatingCategory(false)}
                      variant="ghost"
                      className="text-gray-500 text-xs h-10 px-3 shrink-0"
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsCreatingCategory(true)}
                    className="mt-2 text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 focus:outline-none"
                  >
                    <Plus className="w-3.5 h-3.5" /> Create New Category
                  </button>
                )}
              </div>

              <Input
                label="Stock Quantity"
                type="number"
                placeholder="Available stock"
                value={product.stock}
                onChange={(e) => setProduct({ ...product, stock: e.target.value })}
                required
              />

              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Product Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={product.description}
                  onChange={(e) => setProduct({ ...product, description: e.target.value })}
                  rows="4"
                  placeholder="Detailed description of the product..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </Card>

          <Alert
            variant="info"
            title="Product ID"
            message={`This product's unique identifier is: ${id}`}
          />

          <div className="flex justify-end">
            <Button onClick={() => setActiveTab('pricing')} icon={<DollarSign className="w-4 h-4" />} iconPosition="right">
              Next: Pricing
            </Button>
          </div>
        </motion.div>
      )}

      {/* Pricing Tab */}
      {activeTab === 'pricing' && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          <Card title="Pricing Information" icon={<DollarSign className="w-5 h-5 text-green-600" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="MRP (Maximum Retail Price)"
                type="number"
                placeholder="₹ 0.00"
                value={product.mrp}
                onChange={(e) => setProduct({ ...product, mrp: e.target.value })}
                icon={<DollarSign className="w-4 h-4" />}
              />

              <Input
                label="Selling Price"
                type="number"
                placeholder="₹ 0.00"
                value={product.sellingPrice}
                onChange={(e) => setProduct({
                  ...product,
                  sellingPrice: e.target.value,
                  price: e.target.value
                })}
                icon={<DollarSign className="w-4 h-4" />}
                required
              />

              {discountPercentage() > 0 && (
                <div className="col-span-1 md:col-span-2">
                  <Alert
                    variant="success"
                    title="Discount Applied"
                    message={`Customers will save ${discountPercentage()}% on this product!`}
                  />
                </div>
              )}

              <div className="col-span-1 md:col-span-2 mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="notifyUsers"
                    checked={notifyUsers}
                    onChange={(e) => setNotifyUsers(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <label htmlFor="notifyUsers" className="font-bold text-gray-900 cursor-pointer">
                      Notify users about price drop or restock
                    </label>
                    <p className="text-sm text-gray-600">
                      Send a push notification to all users who have this product in their wishlist or have enabled notifications.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <div className="flex justify-between">
            <Button onClick={() => setActiveTab('basic')} variant="outline">Back</Button>
            <Button onClick={() => setActiveTab('images')} icon={<ImageIcon className="w-4 h-4" />} iconPosition="right">
              Next: Images
            </Button>
          </div>
        </motion.div>
      )}

      {/* Images Tab */}
      {activeTab === 'images' && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          <Card title="Product Images" icon={<ImageIcon className="w-5 h-5 text-pink-600" />}>
            {/* Source Sub-Tabs */}
            <div className="flex border-b border-gray-200 mb-4 mt-2">
              <button
                type="button"
                onClick={() => setImageSourceTab("file")}
                className={`px-4 py-2 font-semibold text-sm border-b-2 transition-all ${
                  imageSourceTab === "file"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                File Upload
              </button>
              <button
                type="button"
                onClick={() => setImageSourceTab("url")}
                className={`px-4 py-2 font-semibold text-sm border-b-2 transition-all ${
                  imageSourceTab === "url"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Import from URLs
              </button>
            </div>

            {imageSourceTab === "file" ? (
              /* Drag & Drop Zone */
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById("file-upload").click()}
                className={`mb-6 border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ${
                  dragActive
                    ? "border-blue-500 bg-blue-50/50 scale-[1.01]"
                    : "border-gray-300 hover:border-blue-400 hover:bg-gray-50/50"
                }`}
              >
                <input
                  id="file-upload"
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="p-3 bg-blue-50 rounded-full text-blue-500">
                    <ImageIcon className="w-8 h-8 animate-bounce" />
                  </div>
                  <p className="font-semibold text-gray-700">Drag and drop images here, or click to browse</p>
                  <p className="text-xs text-gray-400 font-medium">Images will be run through the background processing/optimization pipeline and uploaded to the CDN</p>
                </div>
              </div>
            ) : (
              /* Import from URLs Input Panel */
              <div className="bg-gray-50 border border-gray-150 rounded-xl p-6 mb-6 space-y-4">
                <div className="space-y-1">
                  <label htmlFor="url-import-input" className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Enter Third-Party Image URLs
                  </label>
                  <textarea
                    id="url-import-input"
                    rows={4}
                    placeholder="Paste image URLs here (one URL per line)...&#10;Example:&#10;https://another-shop.com/product.png&#10;https://shopify-store.com/shoes.jpg"
                    className="w-full rounded-lg border border-gray-300 bg-white p-3 font-mono text-xs text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                    value={urlsText}
                    onChange={(e) => setUrlsText(e.target.value)}
                    disabled={isFetchingUrls}
                  />
                </div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <span className="text-[11px] text-gray-400 font-medium">
                    URLs will be requested via proxy, processed (white BG overlay/compression checks), and queued.
                  </span>
                  <Button
                    type="button"
                    onClick={handleImportUrls}
                    disabled={isFetchingUrls || !urlsText.trim()}
                    className="w-full sm:w-auto px-5 py-2 font-bold bg-blue-600 hover:bg-blue-700 text-white shrink-0"
                  >
                    {isFetchingUrls ? "Importing..." : "Import Images"}
                  </Button>
                </div>
              </div>
            )}

            {/* Upload Queue Progress */}
            {uploadQueue.length > 0 && (
              <div className="mb-6 space-y-2">
                {uploadQueue.map(item => (
                  <div key={item.id} className="bg-gray-50 border border-gray-150 rounded-lg p-3 flex flex-col space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-gray-700 truncate max-w-[45%]">{item.name}</span>
                      {item.info && <span className="text-[10px] text-indigo-650 font-semibold">{item.info}</span>}
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        item.status === 'processing' ? 'bg-amber-100 text-amber-700' :
                        item.status === 'uploading' ? 'bg-blue-100 text-blue-700' : 
                        item.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {item.status} {item.status === 'uploading' ? `${item.progress}%` : ''}
                      </span>
                    </div>
                    {item.status === 'uploading' && (
                      <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${item.progress}%` }}></div>
                      </div>
                    )}
                    {item.status === 'error' && (
                      <p className="text-[10px] text-red-500 mt-1">{item.errorMsg}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {['image', 'image2', 'image3'].map((imgKey, index) => (
                <div key={imgKey}>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {index === 0 ? 'Primary Image' : index === 1 ? 'Secondary Image' : 'Tertiary Image'}
                    {index === 0 && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <Input
                    type="url"
                    placeholder="Image URL"
                    value={product[imgKey] || ""}
                    onChange={(e) => setProduct({ ...product, [imgKey]: e.target.value })}
                    className="mb-0"
                  />
                  {product[imgKey] && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="mt-2 relative group"
                    >
                      <img
                        src={product[imgKey]}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-48 object-cover rounded-lg border-2 border-gray-200 group-hover:border-blue-500 transition-all duration-200"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="100%" height="100%" fill="%23eee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%23aaa">Invalid Image</text></svg>';
                        }}
                      />
                      <button
                        onClick={() => setProduct({ ...product, [imgKey]: '' })}
                        className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <div className="flex justify-between">
            <Button onClick={() => setActiveTab('pricing')} variant="outline">Back</Button>
            <Button onClick={() => setActiveTab('details')} icon={<Info className="w-4 h-4" />} iconPosition="right">
              Next: Details
            </Button>
          </div>
        </motion.div>
      )}

      {/* Details Tab */}
      {activeTab === 'details' && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          {/* Tags */}
          <Card title="Product Tags" icon={<Tag className="w-5 h-5 text-indigo-600" />}>
            <div className="flex flex-wrap gap-2 mb-4">
              {product.tags.map((tag, index) => (
                <Badge key={index} variant="info">
                  {tag}
                  <button onClick={() => removeTag(tag)} className="ml-2 hover:text-red-500">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add a tag"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                className="mb-0 flex-1"
              />
              <Button onClick={addTag} icon={<Plus className="w-4 h-4" />}>Add</Button>
            </div>
          </Card>

          {/* Features */}
          <Card title="Key Features" icon={<Check className="w-5 h-5 text-green-600" />}>
            <div className="space-y-2 mb-4">
              {product.features.map((feature, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-700">• {feature}</span>
                  <button onClick={() => removeFeature(index)} className="text-red-500 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add a feature"
                value={featureInput}
                onChange={(e) => setFeatureInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                className="mb-0 flex-1"
              />
              <Button onClick={addFeature} icon={<Plus className="w-4 h-4" />}>Add</Button>
            </div>
          </Card>

          {/* Specifications */}
          <Card title="Specifications" icon={<Info className="w-5 h-5 text-blue-600" />}>
            <div className="space-y-2 mb-4">
              {product.specifications.map((spec, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1 grid grid-cols-2 gap-4">
                    <span className="font-semibold text-gray-700">{spec.key}:</span>
                    <span className="text-gray-600">{spec.value}</span>
                  </div>
                  <button onClick={() => removeSpecification(index)} className="text-red-500 hover:text-red-700 ml-4">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Specification name" value={specKey} onChange={(e) => setSpecKey(e.target.value)} className="mb-0" />
              <div className="flex gap-2">
                <Input placeholder="Value" value={specValue} onChange={(e) => setSpecValue(e.target.value)} className="mb-0 flex-1" />
                <Button onClick={addSpecification} icon={<Plus className="w-4 h-4" />}>Add</Button>
              </div>
            </div>
          </Card>

          {/* Additional Info */}
          <Card title="Additional Information">
            <div className="space-y-4">
              <Input
                label="Country of Origin"
                placeholder="e.g., India, Japan, Germany"
                value={product.origin}
                onChange={(e) => setProduct({ ...product, origin: e.target.value })}
                className="mb-0"
              />

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Additional Notes</label>
                <textarea
                  value={product.additionalInfo}
                  onChange={(e) => setProduct({ ...product, additionalInfo: e.target.value })}
                  rows="3"
                  placeholder="Any additional information..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showOnHome"
                  checked={product.showOnHome || false}
                  onChange={(e) => setProduct({ ...product, showOnHome: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="showOnHome" className="text-gray-700 cursor-pointer">
                  Display this product on homepage
                </label>
              </div>
            </div>
          </Card>

          <div className="flex justify-between">
            <Button onClick={() => setActiveTab('images')} variant="outline">Back</Button>
            <Button onClick={() => setActiveTab('warranty')} icon={<Shield className="w-4 h-4" />} iconPosition="right">
              Next: Warranty
            </Button>
          </div>
        </motion.div>
      )}

      {/* Warranty Tab */}
      {activeTab === 'warranty' && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          <Card title="Warranty & Guarantee" icon={<Shield className="w-5 h-5 text-yellow-600" />}>
            {/* Warranty */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="checkbox"
                  id="warranty"
                  checked={product.warranty.available}
                  onChange={(e) => setProduct({
                    ...product,
                    warranty: { ...product.warranty, available: e.target.checked }
                  })}
                  className="w-4 h-4"
                />
                <label htmlFor="warranty" className="font-semibold text-gray-700 cursor-pointer">
                  Product has warranty
                </label>
              </div>

              {product.warranty.available && (
                <div className="pl-6 space-y-4">
                  <Input
                    label="Warranty Period"
                    placeholder="e.g., 1 year, 6 months"
                    value={product.warranty.period}
                    onChange={(e) => setProduct({
                      ...product,
                      warranty: { ...product.warranty, period: e.target.value }
                    })}
                  />
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Warranty Details</label>
                    <textarea
                      value={product.warranty.details}
                      onChange={(e) => setProduct({
                        ...product,
                        warranty: { ...product.warranty, details: e.target.value }
                      })}
                      rows="3"
                      placeholder="Describe what the warranty covers..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Guarantee */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="checkbox"
                  id="guarantee"
                  checked={product.guarantee.available}
                  onChange={(e) => setProduct({
                    ...product,
                    guarantee: { ...product.guarantee, available: e.target.checked }
                  })}
                  className="w-4 h-4"
                />
                <label htmlFor="guarantee" className="font-semibold text-gray-700 cursor-pointer">
                  Product has guarantee
                </label>
              </div>

              {product.guarantee.available && (
                <div className="pl-6 space-y-4">
                  <Input
                    label="Guarantee Period"
                    placeholder="e.g., Lifetime, 3 years"
                    value={product.guarantee.period}
                    onChange={(e) => setProduct({
                      ...product,
                      guarantee: { ...product.guarantee, period: e.target.value }
                    })}
                  />
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Guarantee Details</label>
                    <textarea
                      value={product.guarantee.details}
                      onChange={(e) => setProduct({
                        ...product,
                        guarantee: { ...product.guarantee, details: e.target.value }
                      })}
                      rows="3"
                      placeholder="Describe what the guarantee covers..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Import Details */}
          <Card title="Import Information" icon={<Globe className="w-5 h-5 text-purple-600" />}>
            <div className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                id="imported"
                checked={product.importDetails.isImported}
                onChange={(e) => setProduct({
                  ...product,
                  importDetails: { ...product.importDetails, isImported: e.target.checked }
                })}
                className="w-4 h-4"
              />
              <label htmlFor="imported" className="font-semibold text-gray-700 cursor-pointer">
                This is an imported product
              </label>
            </div>

            {product.importDetails.isImported && (
              <div className="pl-6 space-y-4">
                <Input
                  label="Imported From"
                  placeholder="e.g., Japan, USA"
                  value={product.importDetails.country}
                  onChange={(e) => setProduct({
                    ...product,
                    importDetails: { ...product.importDetails, country: e.target.value }
                  })}
                />
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Delivery Note</label>
                  <textarea
                    value={product.importDetails.deliveryNote}
                    onChange={(e) => setProduct({
                      ...product,
                      importDetails: { ...product.importDetails, deliveryNote: e.target.value }
                    })}
                    rows="2"
                    placeholder="e.g., May take 3-4 weeks for delivery"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </Card>

          <div className="flex justify-between">
            <Button onClick={() => setActiveTab('details')} variant="outline">Back</Button>
            <Button
              onClick={handleUpdateProduct}
              variant="success"
              loading={isSubmitting}
              icon={<Save className="w-4 h-4" />}
              iconPosition="right"
            >
              {isSubmitting ? "Updating Product..." : "Save Changes"}
            </Button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default EditProduct;
