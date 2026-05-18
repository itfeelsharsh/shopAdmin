import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";

/**
 * CouponManager Component
 * Provides a comprehensive interface for managing discount coupons
 * Features include creating, editing, and deleting coupons with various options
 * Enhanced with product-specific coupon functionality
 */
const CouponManager = () => {
  // State variables
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState(null);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [products, setProducts] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [isProductsDropdownOpen, setIsProductsDropdownOpen] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [deletingCouponId, setDeletingCouponId] = useState(null);
  
  // New coupon state with default values
  const [newCoupon, setNewCoupon] = useState({
    code: "",
    discountType: "percentage", // percentage or fixed
    discountValue: 0,
    maxUses: 0, // 0 for unlimited
    usedCount: 0,
    minOrderAmount: 0,
    maxDiscountAmount: 0, // 0 for no limit
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
    isActive: true,
    description: "",
    applicableProducts: [], // Empty array means applicable to all products
    isProductSpecific: false, // New flag to determine if coupon is product-specific
  });

  /**
   * Fetch coupons and products when component mounts
   */
  useEffect(() => {
    fetchCoupons();
    fetchProducts();
  }, []);

  /**
   * Fetches all coupons from Firestore
   */
  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const couponsCollection = collection(db, "coupons");
      const couponsSnapshot = await getDocs(couponsCollection);
      const couponsList = couponsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        isProductSpecific: doc.data().applicableProducts && doc.data().applicableProducts.length > 0,
      }));
      setCoupons(couponsList);
    } catch (error) {
      console.error("Error fetching coupons:", error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetches all products from Firestore
   */
  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      const productsCollection = collection(db, "products");
      const productsSnapshot = await getDocs(productsCollection);
      const productsList = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setProducts(productsList);
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoadingProducts(false);
    }
  };

  /**
   * Handles adding a new coupon to Firestore
   */
  const handleAddCoupon = async () => {
    // Validation
    if (!newCoupon.code) {
      alert("Please enter a coupon code");
      return;
    }

    if (newCoupon.discountValue <= 0) {
      alert("Discount value must be greater than zero");
      return;
    }

    if (newCoupon.discountType === "percentage" && newCoupon.discountValue > 100) {
      alert("Percentage discount cannot exceed 100%");
      return;
    }

    // Check for existing coupon with the same code
    const existingCoupon = coupons.find(
      coupon => coupon.code.toLowerCase() === newCoupon.code.toLowerCase()
    );
    
    if (existingCoupon) {
      alert("A coupon with this code already exists");
      return;
    }

    setIsSubmitting(true);
    setSubmissionStatus("submitting");
    
    try {
      // Enforce deliberate 2-second delay for professional visual confirmation
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Format dates to timestamps
      const couponToSave = {
        ...newCoupon,
        createdAt: new Date(),
        code: newCoupon.code.toUpperCase(), // Store coupon codes in uppercase
        discountValue: Number(newCoupon.discountValue),
        maxUses: Number(newCoupon.maxUses),
        minOrderAmount: Number(newCoupon.minOrderAmount),
        maxDiscountAmount: Number(newCoupon.maxDiscountAmount),
        isProductSpecific: newCoupon.isProductSpecific,
        // Only include applicable products if product-specific
        applicableProducts: newCoupon.isProductSpecific ? newCoupon.applicableProducts : [],
      };

      await addDoc(collection(db, "coupons"), couponToSave);
      
      // Reset form
      setNewCoupon({
        code: "",
        discountType: "percentage",
        discountValue: 0,
        maxUses: 0,
        usedCount: 0,
        minOrderAmount: 0,
        maxDiscountAmount: 0,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
        isActive: true,
        description: "",
        applicableProducts: [],
        isProductSpecific: false,
      });
      setSelectedProducts([]);
      
      setSubmissionStatus("success");
      
      // Refetch coupons
      fetchCoupons();
    } catch (error) {
      console.error("Error adding coupon:", error);
      setSubmissionStatus("error");
    } finally {
      setTimeout(() => {
        setIsSubmitting(false);
        setSubmissionStatus(null);
      }, 1000);
    }
  };

  /**
   * Sets up editing mode for a coupon
   * @param {Object} coupon - The coupon object to edit
   */
  const startEditCoupon = (coupon) => {
    // Set selected products for UI display
    setSelectedProducts(
      products.filter(product => 
        coupon.applicableProducts && coupon.applicableProducts.includes(product.id)
      )
    );
    
    setEditingCoupon({
      ...coupon,
      startDate: coupon.startDate ? new Date(coupon.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      endDate: coupon.endDate ? new Date(coupon.endDate).toISOString().split('T')[0] : new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
      isProductSpecific: coupon.isProductSpecific || (coupon.applicableProducts && coupon.applicableProducts.length > 0),
    });
  };

  /**
   * Updates an existing coupon in Firestore
   */
  const handleUpdateCoupon = async () => {
    if (!editingCoupon) return;

    setIsSubmitting(true);
    setSubmissionStatus("submitting");
    
    try {
      // Enforce deliberate 2-second delay for professional visual confirmation
      await new Promise(resolve => setTimeout(resolve, 2000));

      const couponRef = doc(db, "coupons", editingCoupon.id);
      
      // Format dates and values properly
      const couponToUpdate = {
        ...editingCoupon,
        code: editingCoupon.code.toUpperCase(),
        discountValue: Number(editingCoupon.discountValue),
        maxUses: Number(editingCoupon.maxUses),
        minOrderAmount: Number(editingCoupon.minOrderAmount),
        maxDiscountAmount: Number(editingCoupon.maxDiscountAmount),
        updatedAt: new Date(),
        isProductSpecific: editingCoupon.isProductSpecific,
        // Only include applicable products if product-specific
        applicableProducts: editingCoupon.isProductSpecific ? editingCoupon.applicableProducts : [],
      };
      
      delete couponToUpdate.id; // Remove id field before updating
      
      await updateDoc(couponRef, couponToUpdate);
      
      setSubmissionStatus("success");
      setEditingCoupon(null);
      setSelectedProducts([]);
      
      // Refetch coupons
      fetchCoupons();
    } catch (error) {
      console.error("Error updating coupon:", error);
      setSubmissionStatus("error");
    } finally {
      setTimeout(() => {
        setIsSubmitting(false);
        setSubmissionStatus(null);
      }, 1000);
    }
  };

  /**
   * Deletes a coupon from Firestore
   * @param {string} id - The id of the coupon to delete
   */
  const handleDeleteCoupon = async (id) => {
    if (!window.confirm("Are you sure you want to delete this coupon?")) {
      return;
    }

    try {
      setDeletingCouponId(id);
      
      // Enforce deliberate 2-second delay for professional visual confirmation
      await new Promise(resolve => setTimeout(resolve, 2000));

      await deleteDoc(doc(db, "coupons", id));
      setCoupons(coupons.filter(coupon => coupon.id !== id));
    } catch (error) {
      console.error("Error deleting coupon:", error);
      alert("Failed to delete the coupon. Please try again.");
    } finally {
      setDeletingCouponId(null);
    }
  };

  /**
   * Checks if a coupon's end date has passed
   * @param {string} endDate - The end date of the coupon
   * @returns {boolean} - Whether the coupon has expired
   */
  const isCouponExpired = (endDate) => {
    if (!endDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const couponEndDate = new Date(endDate);
    return couponEndDate < today;
  };

  /**
   * Generates a random coupon code
   */
  const generateCouponCode = () => {
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed similar looking characters
    let result = '';
    const length = 8; // 8-character code
    
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    // Check if the generated code already exists
    const codeExists = coupons.some(coupon => coupon.code === result);
    if (codeExists) {
      return generateCouponCode(); // Try again if code already exists
    }
    
    if (editingCoupon) {
      setEditingCoupon({...editingCoupon, code: result});
    } else {
      setNewCoupon({...newCoupon, code: result});
    }
  };

  /**
   * Toggle product selection for coupon
   * @param {Object} product - The product to toggle selection
   */
  const toggleProductSelection = (product) => {
    const isEditing = !!editingCoupon;
    const currentCoupon = isEditing ? editingCoupon : newCoupon;
    const currentProducts = currentCoupon.applicableProducts || [];
    
    // Check if the product is already selected
    const isSelected = currentProducts.includes(product.id);
    
    // Create updated products array
    const updatedProducts = isSelected 
      ? currentProducts.filter(id => id !== product.id)
      : [...currentProducts, product.id];
    
    // Update the selected products for display
    setSelectedProducts(
      products.filter(p => updatedProducts.includes(p.id))
    );
    
    // Update the coupon's applicable products
    if (isEditing) {
      setEditingCoupon({...editingCoupon, applicableProducts: updatedProducts});
    } else {
      setNewCoupon({...newCoupon, applicableProducts: updatedProducts});
    }
  };

  /**
   * Filter products based on search term
   */
  const filteredProducts = productSearchTerm 
    ? products.filter(p => 
        p.name.toLowerCase().includes(productSearchTerm.toLowerCase()) || 
        (p.brand || "").toLowerCase().includes(productSearchTerm.toLowerCase())
      )
    : products;

  /**
   * Renders the coupon form (either for adding or editing)
   * @param {Object} couponData - The coupon data to bind to the form
   * @param {Function} setCouponData - The function to update the coupon data
   * @param {Function} submitHandler - The function to handle form submission
   * @param {boolean} isEdit - Whether this form is for editing an existing coupon
   */
  const renderCouponForm = (couponData, setCouponData, submitHandler, isEdit) => {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-bold mb-4 border-b pb-2">
          {isEdit ? "Edit Coupon" : "Create New Coupon"}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Coupon Code */}
          <div className="mb-4">
            <label className="block text-gray-700 font-bold mb-2">
              Coupon Code *
            </label>
            <div className="flex">
              <input
                type="text"
                value={couponData.code}
                onChange={(e) => setCouponData({...couponData, code: e.target.value.toUpperCase()})}
                className="shadow border rounded py-2 px-3 text-gray-700 w-full mr-2"
                placeholder="e.g., SUMMER25"
                required
              />
              <button
                type="button"
                onClick={generateCouponCode}
                className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"
              >
                Generate
              </button>
            </div>
          </div>
          
          {/* Discount Type */}
          <div className="mb-4">
            <label className="block text-gray-700 font-bold mb-2">
              Discount Type
            </label>
            <select
              value={couponData.discountType}
              onChange={(e) => setCouponData({...couponData, discountType: e.target.value})}
              className="shadow border rounded py-2 px-3 text-gray-700 w-full"
            >
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed Amount (₹)</option>
            </select>
          </div>
          
          {/* Discount Value */}
          <div className="mb-4">
            <label className="block text-gray-700 font-bold mb-2">
              Discount Value *
            </label>
            <input
              type="number"
              value={couponData.discountValue}
              onChange={(e) => setCouponData({...couponData, discountValue: e.target.value})}
              className="shadow border rounded py-2 px-3 text-gray-700 w-full"
              placeholder={couponData.discountType === "percentage" ? "e.g., 25 (for 25%)" : "e.g., 500 (for ₹500)"}
              min="0"
              required
            />
            {couponData.discountType === "percentage" && couponData.discountValue > 100 && (
              <p className="text-red-500 text-sm mt-1">Percentage discount cannot exceed 100%</p>
            )}
          </div>
          
          {/* Max Discount Amount (for percentage discounts) */}
          {couponData.discountType === "percentage" && (
            <div className="mb-4">
              <label className="block text-gray-700 font-bold mb-2">
                Maximum Discount Amount (₹)
              </label>
              <input
                type="number"
                value={couponData.maxDiscountAmount}
                onChange={(e) => setCouponData({...couponData, maxDiscountAmount: e.target.value})}
                className="shadow border rounded py-2 px-3 text-gray-700 w-full"
                placeholder="0 for no limit"
                min="0"
              />
              <p className="text-gray-500 text-sm mt-1">0 for unlimited discount</p>
            </div>
          )}
          
          {/* Minimum Order Amount */}
          <div className="mb-4">
            <label className="block text-gray-700 font-bold mb-2">
              Minimum Order Amount (₹)
            </label>
            <input
              type="number"
              value={couponData.minOrderAmount}
              onChange={(e) => setCouponData({...couponData, minOrderAmount: e.target.value})}
              className="shadow border rounded py-2 px-3 text-gray-700 w-full"
              placeholder="0 for no minimum"
              min="0"
            />
          </div>
          
          {/* Max Uses */}
          <div className="mb-4">
            <label className="block text-gray-700 font-bold mb-2">
              Maximum Uses
            </label>
            <input
              type="number"
              value={couponData.maxUses}
              onChange={(e) => setCouponData({...couponData, maxUses: e.target.value})}
              className="shadow border rounded py-2 px-3 text-gray-700 w-full"
              placeholder="0 for unlimited"
              min="0"
            />
            <p className="text-gray-500 text-sm mt-1">0 for unlimited uses</p>
          </div>
          
          {/* Used Count (Edit only) */}
          {isEdit && (
            <div className="mb-4">
              <label className="block text-gray-700 font-bold mb-2">
                Used Count
              </label>
              <input
                type="number"
                value={couponData.usedCount || 0}
                onChange={(e) => setCouponData({...couponData, usedCount: Number(e.target.value)})}
                className="shadow border rounded py-2 px-3 text-gray-700 w-full"
                min="0"
              />
            </div>
          )}
          
          {/* Start Date */}
          <div className="mb-4">
            <label className="block text-gray-700 font-bold mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={couponData.startDate}
              onChange={(e) => setCouponData({...couponData, startDate: e.target.value})}
              className="shadow border rounded py-2 px-3 text-gray-700 w-full"
            />
          </div>
          
          {/* End Date */}
          <div className="mb-4">
            <label className="block text-gray-700 font-bold mb-2">
              End Date
            </label>
            <input
              type="date"
              value={couponData.endDate}
              onChange={(e) => setCouponData({...couponData, endDate: e.target.value})}
              className="shadow border rounded py-2 px-3 text-gray-700 w-full"
              min={couponData.startDate}
            />
          </div>
        </div>
        
        {/* Product-specific coupon toggle */}
        <div className="mb-6">
          <label className="flex items-center mb-4">
            <input
              type="checkbox"
              checked={couponData.isProductSpecific}
              onChange={(e) => setCouponData({
                ...couponData,
                isProductSpecific: e.target.checked,
                applicableProducts: e.target.checked ? couponData.applicableProducts : []
              })}
              className="mr-2"
            />
            <span className="text-gray-700 font-bold">Product-Specific Coupon</span>
          </label>
          
          {couponData.isProductSpecific && (
            <div className="mt-2 border rounded-lg p-4 bg-gray-50">
              <label className="block text-gray-700 font-bold mb-2">
                Select Products for This Coupon
              </label>
              
              {/* Product search input */}
              <div className="relative mb-4">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={productSearchTerm}
                  onChange={(e) => setProductSearchTerm(e.target.value)}
                  className="shadow border rounded py-2 px-3 text-gray-700 w-full"
                  onClick={() => setIsProductsDropdownOpen(true)}
                />
                <div className="absolute right-3 top-2.5">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
              
              {/* Selected products count */}
              <div className="mb-2 text-sm text-gray-600">
                {selectedProducts.length} product(s) selected
              </div>
              
              {/* Selected products list */}
              <div className="mb-4 flex flex-wrap gap-2">
                {selectedProducts.map(product => (
                  <div
                    key={product.id}
                    className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full flex items-center"
                  >
                    <span className="truncate max-w-xs">{product.name}</span>
                    <button
                      type="button"
                      onClick={() => toggleProductSelection(product)}
                      className="ml-1 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              
              {/* Product selection dropdown */}
              {isProductsDropdownOpen && (
                <div className="border border-gray-300 rounded-lg bg-white shadow-lg max-h-60 overflow-y-auto z-10 relative">
                  {loadingProducts ? (
                    <div className="flex justify-center p-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
                    </div>
                  ) : filteredProducts.length === 0 ? (
                    <div className="p-4 text-gray-500 text-center">No products found</div>
                  ) : (
                    <ul>
                      {filteredProducts.map(product => {
                        const isSelected = couponData.applicableProducts && couponData.applicableProducts.includes(product.id);
                        return (
                          <li 
                            key={product.id} 
                            className={`p-2 hover:bg-gray-100 cursor-pointer flex items-center ${isSelected ? 'bg-blue-50' : ''}`}
                            onClick={() => toggleProductSelection(product)}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="mr-2"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{product.name}</div>
                              <div className="text-xs text-gray-500">
                                {product.brand ? `${product.brand} • ` : ''}
                                ₹{product.price || '0'}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <div className="p-2 border-t bg-gray-50 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setIsProductsDropdownOpen(false)}
                      className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
              
              <button
                type="button"
                onClick={() => setIsProductsDropdownOpen(!isProductsDropdownOpen)}
                className="mt-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
              >
                {isProductsDropdownOpen ? "Close Product List" : "Select Products"}
              </button>
              
              {couponData.isProductSpecific && couponData.applicableProducts && couponData.applicableProducts.length === 0 && (
                <p className="text-amber-500 text-sm mt-2">
                  No products selected. This coupon won't be applicable to any products.
                </p>
              )}
            </div>
          )}
        </div>
        
        {/* Description */}
        <div className="mb-4">
          <label className="block text-gray-700 font-bold mb-2">
            Description
          </label>
          <textarea
            value={couponData.description}
            onChange={(e) => setCouponData({...couponData, description: e.target.value})}
            className="shadow border rounded py-2 px-3 text-gray-700 w-full"
            rows="2"
            placeholder="Optional description of the coupon"
          />
        </div>
        
        {/* Active Status */}
        <div className="mb-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={couponData.isActive}
              onChange={(e) => setCouponData({...couponData, isActive: e.target.checked})}
              className="mr-2"
            />
            <span className="text-gray-700 font-bold">Active</span>
          </label>
        </div>
        
        {/* Submit Button */}
        <div className="flex justify-end">
          {isEdit && (
            <button
              type="button"
              onClick={() => setEditingCoupon(null)}
              className="bg-gray-500 text-white p-2 rounded mr-2"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={submitHandler}
            disabled={isSubmitting}
            className={`p-2 px-4 rounded text-white ${
              isSubmitting 
                ? 'bg-gray-400 cursor-not-allowed' 
                : submissionStatus === 'success' 
                  ? 'bg-green-500'
                  : submissionStatus === 'error'
                    ? 'bg-red-500'
                    : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {isSubmitting ? "Saving..." :
             submissionStatus === 'success' ? "Saved!" :
             submissionStatus === 'error' ? "Error!" : 
             isEdit ? "Update Coupon" : "Create Coupon"}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Coupon Management</h1>

      {/* Add/Edit Coupon Form */}
      {editingCoupon
        ? renderCouponForm(editingCoupon, setEditingCoupon, handleUpdateCoupon, true)
        : renderCouponForm(newCoupon, setNewCoupon, handleAddCoupon, false)}

      {/* Coupons List */}
      <h2 className="text-xl font-bold mb-4">Existing Coupons</h2>
      
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
        </div>
      ) : coupons.length === 0 ? (
        <div className="bg-gray-100 p-6 rounded text-center text-gray-500">
          No coupons created yet
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-4 py-2">Code</th>
                <th className="border px-4 py-2">Value</th>
                <th className="border px-4 py-2">Uses</th>
                <th className="border px-4 py-2">Valid Period</th>
                <th className="border px-4 py-2">Product Specific</th>
                <th className="border px-4 py-2">Status</th>
                <th className="border px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => (
                <tr key={coupon.id} className={`hover:bg-gray-50 ${!coupon.isActive || isCouponExpired(coupon.endDate) ? 'bg-gray-100' : ''}`}>
                  <td className="border px-4 py-2 font-mono font-bold">{coupon.code}</td>
                  <td className="border px-4 py-2">
                    {coupon.discountType === "percentage" 
                      ? `${coupon.discountValue}%` 
                      : `₹${coupon.discountValue}`}
                    {coupon.discountType === "percentage" && coupon.maxDiscountAmount > 0 && 
                      ` (up to ₹${coupon.maxDiscountAmount})`
                    }
                    {coupon.minOrderAmount > 0 && 
                      <div className="text-xs text-gray-500">
                        Min order: ₹{coupon.minOrderAmount}
                      </div>
                    }
                  </td>
                  <td className="border px-4 py-2">
                    {coupon.maxUses > 0 
                      ? `${coupon.usedCount || 0}/${coupon.maxUses}`
                      : `${coupon.usedCount || 0}/∞`
                    }
                  </td>
                  <td className="border px-4 py-2 whitespace-nowrap">
                    <div>
                      {new Date(coupon.startDate).toLocaleDateString()}
                      {" - "}
                      {new Date(coupon.endDate).toLocaleDateString()}
                    </div>
                    {isCouponExpired(coupon.endDate) && (
                      <span className="text-xs text-red-500">Expired</span>
                    )}
                  </td>
                  <td className="border px-4 py-2 text-center">
                    {coupon.isProductSpecific || (coupon.applicableProducts && coupon.applicableProducts.length > 0) ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        Yes ({(coupon.applicableProducts || []).length})
                      </span>
                    ) : (
                      <span className="text-gray-500">No</span>
                    )}
                  </td>
                  <td className="border px-4 py-2">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      coupon.isActive && !isCouponExpired(coupon.endDate)
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}>
                      {coupon.isActive && !isCouponExpired(coupon.endDate) ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="border px-4 py-2">
                    <div className="flex gap-1">
                      <button
                        onClick={() => startEditCoupon(coupon)}
                        disabled={isSubmitting || deletingCouponId !== null}
                        className="bg-blue-500 text-white p-1 px-2 rounded hover:bg-blue-600 transition duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteCoupon(coupon.id)}
                        disabled={isSubmitting || deletingCouponId !== null}
                        className="bg-red-500 text-white p-1 px-2 rounded hover:bg-red-600 transition duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[54px]"
                      >
                        {deletingCouponId === coupon.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        ) : (
                          "Delete"
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CouponManager; 