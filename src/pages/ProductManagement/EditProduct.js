import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Package, DollarSign, Image as ImageIcon, Tag, Info, Check,
  X, Plus, Trash2, Globe, Shield, Save
} from "react-feather";
import { Button, Card, Input, Alert, Badge, LoadingSpinner } from "../../components/ui";
import { toast } from "react-toastify";

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
  const [tagInput, setTagInput] = useState("");
  const [featureInput, setFeatureInput] = useState("");
  const [specKey, setSpecKey] = useState("");
  const [specValue, setSpecValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      const updateData = {
        ...product,
        sellingPrice: Number(product.sellingPrice || product.price),
        mrp: Number(product.mrp || product.price),
        price: Number(product.sellingPrice || product.price),
        stock: Number(product.stock),
        updatedAt: new Date()
      };

      await updateDoc(productRef, updateData);

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
                <select
                  value={product.brand}
                  onChange={(e) => setProduct({ ...product, brand: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Brand</option>
                  {brands.map((brand) => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
                <select
                  value={product.type}
                  onChange={(e) => setProduct({ ...product, type: e.target.value })}
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
                          e.target.src = 'https://via.placeholder.com/300x200?text=Invalid+Image';
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
