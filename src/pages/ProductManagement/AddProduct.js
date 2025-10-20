import { useState } from "react";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Package, DollarSign, Image as ImageIcon, Tag, Info, Check,
  X, Plus, Trash2, Globe, Shield
} from "react-feather";
import { Button, Card, Input, Alert, Badge } from "../../components/ui";
import { toast } from "react-toastify";

const productTypes = [
  'Notebooks and Journals',
  'Pens and Pencils',
  'Paper and Notepads',
  'Planners and Calendars',
  'Office Supplies',
  'Art Supplies',
  'Desk Accessories',
  'Cards and Envelopes',
  'Writing Accessories',
  'Gift Wrap and Packaging',
];

const brands = [
  'Camel', 'Faber-Castell', 'Staedtler', 'Doms', 'Camlin', 'Luxor',
  'Monami', 'Schneider', 'Pentel', 'Pilot', 'Kokuyo', 'Nataraj',
  'OHPen', 'Bic', 'Zebra', 'Stabilo',
];

/**
 * Enhanced Add Product Page with Modern UI
 */
const AddProduct = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('basic');
  const [newProduct, setNewProduct] = useState({
    name: "",
    description: "",
    price: "",
    mrp: "",
    sellingPrice: "",
    brand: "",
    stock: "",
    type: "",
    image: "",
    image2: "",
    image3: "",
    showOnHome: false,
    tags: [],
    slug: "",
    origin: "",
    additionalInfo: "",
    warranty: { available: false, period: "", details: "" },
    guarantee: { available: false, period: "", details: "" },
    importDetails: { isImported: false, country: "", deliveryNote: "" },
    specifications: [],
    features: []
  });

  const [tagInput, setTagInput] = useState("");
  const [featureInput, setFeatureInput] = useState("");
  const [specKey, setSpecKey] = useState("");
  const [specValue, setSpecValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [slugAvailability, setSlugAvailability] = useState({ checked: false, available: false });
  const [errors, setErrors] = useState({});

  const tabs = [
    { id: 'basic', label: 'Basic Info', icon: Package },
    { id: 'pricing', label: 'Pricing', icon: DollarSign },
    { id: 'images', label: 'Images', icon: ImageIcon },
    { id: 'details', label: 'Details', icon: Info },
    { id: 'warranty', label: 'Warranty', icon: Shield }
  ];

  /**
   * Validate form
   */
  const validateForm = () => {
    const newErrors = {};

    if (!newProduct.name) newErrors.name = "Product name is required";
    if (!newProduct.sellingPrice) newErrors.sellingPrice = "Selling price is required";
    if (!newProduct.slug) newErrors.slug = "URL slug is required";
    if (!slugAvailability.available) newErrors.slug = "Please check slug availability";
    if (!newProduct.image) newErrors.image = "At least one image is required";
    if (!newProduct.stock || newProduct.stock < 0) newErrors.stock = "Valid stock quantity is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Check slug availability
   */
  const checkSlugAvailability = async () => {
    if (!newProduct.slug) {
      toast.error("Please enter a URL slug");
      return;
    }

    try {
      const formattedSlug = newProduct.slug.toLowerCase().trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]/g, '');

      setNewProduct({ ...newProduct, slug: formattedSlug });

      const docRef = doc(db, "products", formattedSlug);
      const docSnap = await getDoc(docRef);

      setSlugAvailability({
        checked: true,
        available: !docSnap.exists()
      });

      if (!docSnap.exists()) {
        toast.success("URL slug is available!");
      } else {
        toast.error("This URL slug is already taken");
      }
    } catch (error) {
      console.error("Error checking slug:", error);
      toast.error("Failed to check slug availability");
    }
  };

  /**
   * Handle product submission
   */
  const handleAddProduct = async () => {
    if (!validateForm()) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setIsSubmitting(true);

      const formattedSlug = newProduct.slug.toLowerCase().trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]/g, '');

      const { slug, ...productToSave } = {
        ...newProduct,
        slug: formattedSlug,
        sellingPrice: Number(newProduct.sellingPrice || newProduct.price),
        mrp: Number(newProduct.mrp || newProduct.price),
        price: Number(newProduct.sellingPrice || newProduct.price),
        stock: Number(newProduct.stock),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const productRef = doc(db, "products", formattedSlug);
      await setDoc(productRef, productToSave);

      toast.success("Product added successfully!");
      setTimeout(() => {
        navigate("/products");
      }, 1500);
    } catch (error) {
      console.error("Error adding product:", error);
      toast.error("Failed to add product");
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Add tag
   */
  const addTag = () => {
    if (tagInput.trim() && !newProduct.tags.includes(tagInput.trim())) {
      setNewProduct({
        ...newProduct,
        tags: [...newProduct.tags, tagInput.trim()]
      });
      setTagInput("");
    }
  };

  /**
   * Remove tag
   */
  const removeTag = (tagToRemove) => {
    setNewProduct({
      ...newProduct,
      tags: newProduct.tags.filter(tag => tag !== tagToRemove)
    });
  };

  /**
   * Add feature
   */
  const addFeature = () => {
    if (featureInput.trim()) {
      setNewProduct({
        ...newProduct,
        features: [...newProduct.features, featureInput.trim()]
      });
      setFeatureInput("");
    }
  };

  /**
   * Remove feature
   */
  const removeFeature = (index) => {
    setNewProduct({
      ...newProduct,
      features: newProduct.features.filter((_, i) => i !== index)
    });
  };

  /**
   * Add specification
   */
  const addSpecification = () => {
    if (specKey.trim() && specValue.trim()) {
      setNewProduct({
        ...newProduct,
        specifications: [...newProduct.specifications, { key: specKey.trim(), value: specValue.trim() }]
      });
      setSpecKey("");
      setSpecValue("");
    }
  };

  /**
   * Remove specification
   */
  const removeSpecification = (index) => {
    setNewProduct({
      ...newProduct,
      specifications: newProduct.specifications.filter((_, i) => i !== index)
    });
  };

  /**
   * Calculate discount percentage
   */
  const discountPercentage = () => {
    const mrp = Number(newProduct.mrp);
    const selling = Number(newProduct.sellingPrice);
    if (mrp > selling && selling > 0) {
      return Math.round(((mrp - selling) / mrp) * 100);
    }
    return 0;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-6xl mx-auto space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Add New Product</h1>
          <p className="text-gray-600 mt-1">Create a new product listing for your store</p>
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
                value={newProduct.name}
                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                error={errors.name}
                required
              />

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Brand
                </label>
                <select
                  value={newProduct.brand}
                  onChange={(e) => setNewProduct({ ...newProduct, brand: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Brand</option>
                  {brands.map((brand) => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={newProduct.type}
                  onChange={(e) => setNewProduct({ ...newProduct, type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Category</option>
                  {productTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <Input
                label="Stock Quantity"
                type="number"
                placeholder="Available stock"
                value={newProduct.stock}
                onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
                error={errors.stock}
                required
              />

              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Product Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                  rows="4"
                  placeholder="Detailed description of the product..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </Card>

          {/* URL Slug */}
          <Card title="Product URL" icon={<Globe className="w-5 h-5 text-purple-600" />}>
            <Alert
              variant="info"
              message="The URL slug will be used as the product's unique identifier and web address"
            />
            <div className="mt-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                URL Slug <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <div className="flex items-center">
                    <span className="bg-gray-100 px-4 py-2 border border-r-0 rounded-l-lg text-gray-600">
                      /product/
                    </span>
                    <input
                      type="text"
                      value={newProduct.slug}
                      onChange={(e) => {
                        setNewProduct({ ...newProduct, slug: e.target.value });
                        setSlugAvailability({ checked: false, available: false });
                      }}
                      placeholder="product-url-slug"
                      className={`flex-1 px-4 py-2 border rounded-r-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        slugAvailability.checked
                          ? slugAvailability.available
                            ? 'border-green-500'
                            : 'border-red-500'
                          : 'border-l-0'
                      }`}
                    />
                  </div>
                  {errors.slug && <p className="text-red-500 text-sm mt-1">{errors.slug}</p>}
                  {slugAvailability.checked && (
                    <p className={`text-sm mt-1 ${slugAvailability.available ? 'text-green-600' : 'text-red-600'}`}>
                      {slugAvailability.available ? '✓ URL is available!' : '✗ URL is already taken'}
                    </p>
                  )}
                </div>
                <Button
                  onClick={checkSlugAvailability}
                  variant="outline"
                  disabled={!newProduct.slug}
                >
                  Check
                </Button>
              </div>
            </div>
          </Card>

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
                value={newProduct.mrp}
                onChange={(e) => setNewProduct({ ...newProduct, mrp: e.target.value })}
                icon={<DollarSign className="w-4 h-4" />}
              />

              <Input
                label="Selling Price"
                type="number"
                placeholder="₹ 0.00"
                value={newProduct.sellingPrice}
                onChange={(e) => setNewProduct({
                  ...newProduct,
                  sellingPrice: e.target.value,
                  price: e.target.value
                })}
                icon={<DollarSign className="w-4 h-4" />}
                error={errors.sellingPrice}
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
            </div>
          </Card>

          <div className="flex justify-between">
            <Button onClick={() => setActiveTab('basic')} variant="outline">
              Back
            </Button>
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
            <Alert
              variant="info"
              message="Add high-quality images for better product presentation. First image will be the primary display image."
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
              {['image', 'image2', 'image3'].map((imgKey, index) => (
                <div key={imgKey}>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {index === 0 ? 'Primary Image' : index === 1 ? 'Secondary Image' : 'Tertiary Image'}
                    {index === 0 && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <Input
                    type="url"
                    placeholder="Image URL"
                    value={newProduct[imgKey]}
                    onChange={(e) => setNewProduct({ ...newProduct, [imgKey]: e.target.value })}
                    error={index === 0 ? errors.image : undefined}
                    className="mb-0"
                  />
                  {newProduct[imgKey] && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="mt-2 relative group"
                    >
                      <img
                        src={newProduct[imgKey]}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-48 object-cover rounded-lg border-2 border-gray-200 group-hover:border-blue-500 transition-all duration-200"
                        onError={(e) => {
                          e.target.src = 'https://via.placeholder.com/300x200?text=Invalid+Image';
                        }}
                      />
                      <button
                        onClick={() => setNewProduct({ ...newProduct, [imgKey]: '' })}
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
            <Button onClick={() => setActiveTab('pricing')} variant="outline">
              Back
            </Button>
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
              {newProduct.tags.map((tag, index) => (
                <Badge key={index} variant="info">
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="ml-2 hover:text-red-500"
                  >
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
              <Button onClick={addTag} icon={<Plus className="w-4 h-4" />}>
                Add
              </Button>
            </div>
          </Card>

          {/* Features */}
          <Card title="Key Features" icon={<Check className="w-5 h-5 text-green-600" />}>
            <div className="space-y-2 mb-4">
              {newProduct.features.map((feature, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-700">• {feature}</span>
                  <button
                    onClick={() => removeFeature(index)}
                    className="text-red-500 hover:text-red-700"
                  >
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
              <Button onClick={addFeature} icon={<Plus className="w-4 h-4" />}>
                Add
              </Button>
            </div>
          </Card>

          {/* Specifications */}
          <Card title="Specifications" icon={<Info className="w-5 h-5 text-blue-600" />}>
            <div className="space-y-2 mb-4">
              {newProduct.specifications.map((spec, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1 grid grid-cols-2 gap-4">
                    <span className="font-semibold text-gray-700">{spec.key}:</span>
                    <span className="text-gray-600">{spec.value}</span>
                  </div>
                  <button
                    onClick={() => removeSpecification(index)}
                    className="text-red-500 hover:text-red-700 ml-4"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Specification name"
                value={specKey}
                onChange={(e) => setSpecKey(e.target.value)}
                className="mb-0"
              />
              <div className="flex gap-2">
                <Input
                  placeholder="Value"
                  value={specValue}
                  onChange={(e) => setSpecValue(e.target.value)}
                  className="mb-0 flex-1"
                />
                <Button onClick={addSpecification} icon={<Plus className="w-4 h-4" />}>
                  Add
                </Button>
              </div>
            </div>
          </Card>

          {/* Additional Info */}
          <Card title="Additional Information">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Country of Origin
                </label>
                <Input
                  placeholder="e.g., India, Japan, Germany"
                  value={newProduct.origin}
                  onChange={(e) => setNewProduct({ ...newProduct, origin: e.target.value })}
                  className="mb-0"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Additional Notes
                </label>
                <textarea
                  value={newProduct.additionalInfo}
                  onChange={(e) => setNewProduct({ ...newProduct, additionalInfo: e.target.value })}
                  rows="3"
                  placeholder="Any additional information..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showOnHome"
                  checked={newProduct.showOnHome}
                  onChange={(e) => setNewProduct({ ...newProduct, showOnHome: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="showOnHome" className="text-gray-700 cursor-pointer">
                  Display this product on homepage
                </label>
              </div>
            </div>
          </Card>

          <div className="flex justify-between">
            <Button onClick={() => setActiveTab('images')} variant="outline">
              Back
            </Button>
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
                  checked={newProduct.warranty.available}
                  onChange={(e) => setNewProduct({
                    ...newProduct,
                    warranty: { ...newProduct.warranty, available: e.target.checked }
                  })}
                  className="w-4 h-4"
                />
                <label htmlFor="warranty" className="font-semibold text-gray-700 cursor-pointer">
                  Product has warranty
                </label>
              </div>

              {newProduct.warranty.available && (
                <div className="pl-6 space-y-4">
                  <Input
                    label="Warranty Period"
                    placeholder="e.g., 1 year, 6 months"
                    value={newProduct.warranty.period}
                    onChange={(e) => setNewProduct({
                      ...newProduct,
                      warranty: { ...newProduct.warranty, period: e.target.value }
                    })}
                  />
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Warranty Details
                    </label>
                    <textarea
                      value={newProduct.warranty.details}
                      onChange={(e) => setNewProduct({
                        ...newProduct,
                        warranty: { ...newProduct.warranty, details: e.target.value }
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
                  checked={newProduct.guarantee.available}
                  onChange={(e) => setNewProduct({
                    ...newProduct,
                    guarantee: { ...newProduct.guarantee, available: e.target.checked }
                  })}
                  className="w-4 h-4"
                />
                <label htmlFor="guarantee" className="font-semibold text-gray-700 cursor-pointer">
                  Product has guarantee
                </label>
              </div>

              {newProduct.guarantee.available && (
                <div className="pl-6 space-y-4">
                  <Input
                    label="Guarantee Period"
                    placeholder="e.g., Lifetime, 3 years"
                    value={newProduct.guarantee.period}
                    onChange={(e) => setNewProduct({
                      ...newProduct,
                      guarantee: { ...newProduct.guarantee, period: e.target.value }
                    })}
                  />
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Guarantee Details
                    </label>
                    <textarea
                      value={newProduct.guarantee.details}
                      onChange={(e) => setNewProduct({
                        ...newProduct,
                        guarantee: { ...newProduct.guarantee, details: e.target.value }
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
                checked={newProduct.importDetails.isImported}
                onChange={(e) => setNewProduct({
                  ...newProduct,
                  importDetails: { ...newProduct.importDetails, isImported: e.target.checked }
                })}
                className="w-4 h-4"
              />
              <label htmlFor="imported" className="font-semibold text-gray-700 cursor-pointer">
                This is an imported product
              </label>
            </div>

            {newProduct.importDetails.isImported && (
              <div className="pl-6 space-y-4">
                <Input
                  label="Imported From"
                  placeholder="e.g., Japan, USA"
                  value={newProduct.importDetails.country}
                  onChange={(e) => setNewProduct({
                    ...newProduct,
                    importDetails: { ...newProduct.importDetails, country: e.target.value }
                  })}
                />
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Delivery Note
                  </label>
                  <textarea
                    value={newProduct.importDetails.deliveryNote}
                    onChange={(e) => setNewProduct({
                      ...newProduct,
                      importDetails: { ...newProduct.importDetails, deliveryNote: e.target.value }
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
            <Button onClick={() => setActiveTab('details')} variant="outline">
              Back
            </Button>
            <Button
              onClick={handleAddProduct}
              variant="success"
              loading={isSubmitting}
              icon={<Check className="w-4 h-4" />}
              iconPosition="right"
            >
              {isSubmitting ? "Adding Product..." : "Add Product"}
            </Button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default AddProduct;
