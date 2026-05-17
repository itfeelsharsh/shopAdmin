/**
 * Enhanced Admin Orders Management Page
 * 
 * This comprehensive component provides complete order management functionality
 * for administrators with advanced features including:
 * - Real-time order listing with advanced filtering
 * - Status management with workflow validation
 * - Bulk operations for efficiency
 * - Detailed order views with full history
 * - Shipping management with carrier integration
 * - Analytics and reporting capabilities
 * - Search and export functionality
 * - Firebase security rule compliance
 * 
 * The component integrates with the enhanced AdminOrderService to provide
 * a seamless and powerful order management experience.
 * 
 * @author Shop Admin System
 * @version 2.0.0
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Import the enhanced admin order service and utilities
import AdminOrderService, { 
  ORDER_STATUSES, 
  ORDER_PRIORITIES, 
  SHIPPING_CARRIERS 
} from "../utils/orderService";
import { resendOrderConfirmationEmail, sendOrderStatusEmail } from "../utils/emailService";
import { sendUserNotification } from "../utils/notificationService";
import { formatCurrency, formatIndianNumber } from '../utils/formatUtils';

/**
 * Main Orders Management Component
 * Provides comprehensive order management interface for administrators
 */
function Orders() {
  // Core state management for orders and UI
  const [orders, setOrders] = useState([]);                    // Main orders list
  const [filteredOrders, setFilteredOrders] = useState([]);   // Filtered orders based on current filters
  const [loading, setLoading] = useState(true);               // Loading state for data fetching
  const [error, setError] = useState(null);                   // Error state for error handling
  
  // Ref to store the latest fetchOrders function for interval access
  const fetchOrdersRef = useRef(null);
  
  // Ref to prevent rapid successive API calls
  const lastFetchTimeRef = useRef(0);
  const FETCH_DEBOUNCE_MS = 1000; // Minimum time between fetches
  
  // Filter and search state management - Initialize with proper default values
  const [filters, setFilters] = useState({
    status: 'all',                    // Status filter for order workflow
    priority: 'all',                  // Priority filter for urgent orders
    searchTerm: '',                   // Search term for order/customer lookup
    dateRange: {
      startDate: '',                  // Start date for date range filtering
      endDate: ''                     // End date for date range filtering
    },
    minAmount: '',                    // Minimum order amount filter
    carrier: 'all'                    // Shipping carrier filter
  });
  
  // Modal and UI state management - Initialize with proper default values
  const [selectedOrder, setSelectedOrder] = useState(null);   // Currently selected order for detailed view
  const [isModalOpen, setIsModalOpen] = useState(false);     // Modal visibility state
  const [modalMode, setModalMode] = useState('view');        // Modal mode: 'view', 'edit', 'shipping'
  const [processingAction, setProcessingAction] = useState(false); // Action processing state
  
  // Bulk operations state management - Initialize with proper Set object
  const [selectedOrderIds, setSelectedOrderIds] = useState(() => new Set()); // Selected orders for bulk operations
  const [bulkOperationMode, setBulkOperationMode] = useState(false);   // Bulk operation mode toggle
  
  // Shipping management state - Initialize with proper default values
  const [shippingInfo, setShippingInfo] = useState({
    trackingNumber: '',               // Tracking number for shipment
    carrier: 'IndiaPost',            // Selected shipping carrier
    service: 'standard',             // Shipping service type
    weight: '',                      // Package weight
    notes: ''                        // Additional shipping notes
  });
  
  // Analytics and reporting state - Initialize with proper default values
  const [showAnalytics, setShowAnalytics] = useState(false);  // Analytics view toggle
  const [analyticsData, setAnalyticsData] = useState(null);   // Analytics data cache
  const [analyticsLoading, setAnalyticsLoading] = useState(false); // Analytics loading state
  
  // Pagination state management
  const [pagination, setPagination] = useState({
    limit: 10,
    lastDoc: null,
    hasMore: false,
    currentPage: 1
  });

  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [isSendingNotification, setIsSendingNotification] = useState(false);

  /**
   * Comprehensive order status configuration with enhanced styling and workflow
   * Defines visual appearance, workflow rules, and actions for each order status
   */
  const ORDER_STATUS_CONFIG = useMemo(() => ({
    [ORDER_STATUSES.PLACED]: { 
      label: 'Placed', 
      color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      description: 'Order placed by customer, awaiting admin approval',
      nextActions: ['approve', 'decline'],
      workflow: {
        canApprove: true,
        canDecline: true,
        canCancel: true,
        requiresAction: true
      }
    },
    [ORDER_STATUSES.APPROVED]: { 
      label: 'Approved', 
      color: 'bg-blue-100 text-blue-800 border-blue-200',
      description: 'Order approved by admin, ready for packing',
      nextActions: ['pack'],
      workflow: {
        canPack: true,
        canCancel: true,
        requiresAction: true
      }
    },
    [ORDER_STATUSES.PACKED]: { 
      label: 'Packed', 
      color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      description: 'Order packed and ready for shipment',
      nextActions: ['ship'],
      workflow: {
        canShip: true,
        canCancel: true,
        requiresTracking: true
      }
    },
    [ORDER_STATUSES.SHIPPED]: { 
      label: 'Shipped', 
      color: 'bg-purple-100 text-purple-800 border-purple-200',
      description: 'Order shipped to customer with tracking',
      nextActions: ['deliver'],
      workflow: {
        canDeliver: true,
        hasTracking: true
      }
    },
    [ORDER_STATUSES.DELIVERED]: { 
      label: 'Delivered', 
      color: 'bg-green-100 text-green-800 border-green-200',
      description: 'Order successfully delivered to customer',
      nextActions: [],
      workflow: {
        isComplete: true,
        canRefund: true
      }
    },
    [ORDER_STATUSES.DECLINED]: { 
      label: 'Declined', 
      color: 'bg-red-100 text-red-800 border-red-200',
      description: 'Order declined by admin',
      nextActions: [],
      workflow: {
        isTerminal: true,
        inventoryRestored: true
      }
    },
    [ORDER_STATUSES.CANCELLED]: { 
      label: 'Cancelled', 
      color: 'bg-gray-100 text-gray-800 border-gray-200',
      description: 'Order cancelled',
      nextActions: ['refund'],
      workflow: {
        canRefund: true,
        inventoryRestored: true
      }
    },
    [ORDER_STATUSES.REFUNDED]: { 
      label: 'Refunded', 
      color: 'bg-gray-100 text-gray-600 border-gray-200',
      description: 'Order refunded to customer',
      nextActions: [],
      workflow: {
        isTerminal: true,
        isRefunded: true
      }
    }
  }), []);

  /**
   * Priority configuration for order processing workflow
   * Defines visual styling and processing rules for different priority levels
   */
  const PRIORITY_CONFIG = useMemo(() => ({
    [ORDER_PRIORITIES.URGENT]: {
      label: 'Urgent',
      color: 'bg-red-100 text-red-800',
      description: 'Requires immediate attention'
    },
    [ORDER_PRIORITIES.HIGH]: {
      label: 'High',
      color: 'bg-orange-100 text-orange-800',
      description: 'High priority processing'
    },
    [ORDER_PRIORITIES.NORMAL]: {
      label: 'Normal',
      color: 'bg-gray-100 text-gray-800',
      description: 'Standard processing priority'
    },
    [ORDER_PRIORITIES.LOW]: {
      label: 'Low',
      color: 'bg-blue-100 text-blue-800',
      description: 'Low priority, process when time allows'
    }
  }), []);

  /**
   * Comprehensive order fetching function
   * Uses the reliable approach from the original code with enhanced error handling
   */
  const fetchOrders = useCallback(async (loadMore = false) => {
    // Debounce rapid successive calls
    const now = Date.now();
    if (now - lastFetchTimeRef.current < FETCH_DEBOUNCE_MS && !loadMore) {
      return;
    }
    lastFetchTimeRef.current = now;
    
    try {
      setLoading(true);
      setError(null);
      
      const result = await AdminOrderService.getAllOrders(filters, {
        limit: pagination.limit,
        lastDoc: loadMore ? pagination.lastDoc : null
      });

      if (result.success) {
        if (loadMore) {
          setOrders(prev => [...prev, ...result.orders]);
        } else {
          setOrders(result.orders);
        }
        
        setPagination(prev => ({
          ...prev,
          lastDoc: result.lastDoc,
          hasMore: result.hasMore,
          currentPage: loadMore ? prev.currentPage + 1 : 1
        }));

        if (!loadMore && result.orders.length > 0) {
          toast.success(`Refreshed ${result.orders.length} orders`);
        }
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError(err.message);
      toast.error(`Failed to load orders: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.limit, pagination.lastDoc]);
  
  // Update the ref whenever fetchOrders changes
  useEffect(() => {
    fetchOrdersRef.current = fetchOrders;
  }, [fetchOrders]);

  // Load more function
  const handleLoadMore = () => {
    if (pagination.hasMore && !loading) {
      fetchOrders(true);
    }
  };

  /**
   * Extract order total from various possible fields
   * Different orders might store total in different fields
   */
  const getOrderTotal = useCallback((order) => {
    // Try different possible fields where total might be stored
    const possibleTotalFields = [
      order.total,
      order.amount,
      order.grandTotal,
      order.finalAmount,
      order.orderTotal,
      order.financials?.total,
      order.payment?.amount,
      order.summary?.total,
      order.pricing?.total
    ];

    // Find the first non-zero, non-null, non-undefined value
    for (const field of possibleTotalFields) {
      if (field !== null && field !== undefined && field !== 0 && !isNaN(field)) {
        return Number(field);
      }
    }

    // If all fields are 0 or undefined, calculate from items if available
    if (order.items && Array.isArray(order.items)) {
      const calculatedTotal = order.items.reduce((sum, item) => {
        const itemTotal = (item.price || 0) * (item.quantity || 0);
        return sum + itemTotal;
      }, 0);
      
      if (calculatedTotal > 0) {
        console.log(`Orders: Calculated total ${calculatedTotal} from items for order ${order.id}`);
        return calculatedTotal;
      }
    }

    console.warn(`Orders: Could not determine total for order ${order.id}:`, {
      total: order.total,
      amount: order.amount,
      financials: order.financials,
      payment: order.payment,
      itemsCount: order.items?.length || 0
    });

    return 0;
  }, []);

  /**
   * Advanced filter application function
   * Applies all active filters to the orders list with comprehensive search logic
   */
  const applyFilters = useCallback(() => {
    let filtered = [...orders];
    
    console.log(`🔍 Orders: Applying filters to ${orders.length} orders`);
    
    // Status filter - filter by order status
    if (filters.status && filters.status !== 'all') {
      filtered = filtered.filter(order => order.status === filters.status);
      console.log(`🔍 Orders: Status filter (${filters.status}) applied, ${filtered.length} orders remaining`);
    }
    
    // Priority filter - filter by order priority
    if (filters.priority && filters.priority !== 'all') {
      filtered = filtered.filter(order => (order.priority || ORDER_PRIORITIES.NORMAL) === filters.priority);
      console.log(`🔍 Orders: Priority filter (${filters.priority}) applied, ${filtered.length} orders remaining`);
    }
    
    // Search term filter - comprehensive text search across multiple fields
    if (filters.searchTerm && filters.searchTerm.trim()) {
      const searchTerm = filters.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(order => {
        return (
          // Search in order ID
          order.orderId?.toLowerCase().includes(searchTerm) ||
          order.id?.toLowerCase().includes(searchTerm) ||
          // Search in customer information
          order.userName?.toLowerCase().includes(searchTerm) ||
          order.userEmail?.toLowerCase().includes(searchTerm) ||
          order.userPhone?.toLowerCase().includes(searchTerm) ||
          // Search in product names
          order.items?.some(item => 
            item.name?.toLowerCase().includes(searchTerm)
          ) ||
          // Search in tracking information
          order.tracking?.code?.toLowerCase().includes(searchTerm) ||
          // Search in admin notes
          order.adminNotes?.toLowerCase().includes(searchTerm)
        );
      });
      console.log(`🔍 Orders: Search filter ("${searchTerm}") applied, ${filtered.length} orders remaining`);
    }
    
    // Minimum amount filter - filter by order total
    if (filters.minAmount && !isNaN(parseFloat(filters.minAmount))) {
      const minAmount = parseFloat(filters.minAmount);
      filtered = filtered.filter(order => {
        // Inline order total calculation to avoid circular dependency
        const orderTotal = order.total || order.amount || order.grandTotal || order.finalAmount || 0;
        return orderTotal >= minAmount;
      });
      console.log(`🔍 Orders: Min amount filter (₹${minAmount}) applied, ${filtered.length} orders remaining`);
    }
    
    // Carrier filter - filter by shipping carrier
    if (filters.carrier && filters.carrier !== 'all') {
      filtered = filtered.filter(order => order.tracking?.carrier === filters.carrier);
      console.log(`🔍 Orders: Carrier filter (${filters.carrier}) applied, ${filtered.length} orders remaining`);
    }
    
    // Date range filter - filter by order creation date
    if (filters.dateRange.startDate || filters.dateRange.endDate) {
      filtered = filtered.filter(order => {
        const orderDate = order.createdAt?.toDate?.() || new Date(order.orderDate);
        
        if (filters.dateRange.startDate) {
          const startDate = new Date(filters.dateRange.startDate);
          if (orderDate < startDate) return false;
        }
        
        if (filters.dateRange.endDate) {
          const endDate = new Date(filters.dateRange.endDate);
          endDate.setHours(23, 59, 59, 999); // End of day
          if (orderDate > endDate) return false;
        }
        
        return true;
      });
      console.log(`🔍 Orders: Date range filter applied, ${filtered.length} orders remaining`);
    }
    
    setFilteredOrders(filtered);
    console.log(`✅ Orders: Filters applied successfully, showing ${filtered.length} of ${orders.length} orders`);
  }, [orders, filters]); // Simplified dependencies to prevent circular references

  /**
   * Initial data loading effect
   * Fetches orders on component mount and sets up data refresh
   */
  useEffect(() => {
    console.log('🔄 Orders: Component mounted, initiating data fetch');
    
    // Add error handling to prevent component crashes
    const safeFetchOrders = async () => {
      try {
        await fetchOrders();
      } catch (error) {
        console.error('❌ Orders: Error in initial fetch:', error);
        setError(error.message);
        setLoading(false);
      }
    };
    
    safeFetchOrders();
    
    // Set up auto-refresh for real-time updates (every 5 minutes)
    // Use ref to access the latest fetchOrders function without causing dependency issues
    const refreshInterval = setInterval(() => {
      if (fetchOrdersRef.current) {
        fetchOrdersRef.current();
      }
    }, 5 * 60 * 1000);
    
    // Cleanup interval on component unmount
    return () => {
      clearInterval(refreshInterval);
      console.log('🧹 Orders: Component unmounted, cleaning up resources');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run on mount/unmount

  /**
   * Filter application effect
   * Applies current filters to the orders list whenever filters or orders change
   */
  useEffect(() => {
    console.log('🔍 Orders: Applying filters to orders list');
    applyFilters();
  }, [orders, filters, applyFilters]); // Added applyFilters back to dependency array

  /**
   * Update order status in Firestore (simplified approach from original code)
   * @param {string} orderId - Order ID to update
   * @param {string} newStatus - New status to set
   * @param {Object} additionalInfo - Additional information for the update
   */
  const updateOrderStatus = async (orderId, newStatus, additionalInfo = {}) => {
    console.log(`🔄 Orders: Updating order ${orderId} status to ${newStatus}`);
    
    try {
      setProcessingAction(true);
      
      // Get current order data
      const orderRef = doc(db, "orders", orderId);
      const orderSnap = await getDoc(orderRef);
      
      if (!orderSnap.exists()) {
        throw new Error("Order not found");
      }
      
      const orderData = orderSnap.data();
      
      // Show confirmation for critical status changes
      if (['Declined', 'Cancelled'].includes(newStatus)) {
        const confirmed = window.confirm(
          `Are you sure you want to ${newStatus.toLowerCase()} order ${orderData.orderId || orderId}?\n\n` +
          `This action cannot be easily undone.`
        );
        
        if (!confirmed) {
          console.log('❌ Orders: Status update cancelled by user');
          return;
        }
      }
      
      // Create status history entry
      const statusUpdate = {
        status: newStatus,
        timestamp: new Date().toISOString(),
        note: additionalInfo.note || `Order ${newStatus.toLowerCase()} by admin`
      };
      
      // Update order with new status and history
      await updateDoc(orderRef, {
        status: newStatus,
        statusHistory: [...(orderData.statusHistory || []), statusUpdate],
      });
      
      // Update local state
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderId 
            ? { 
                ...order, 
                status: newStatus,
                statusHistory: [...(order.statusHistory || []), statusUpdate]
              } 
            : order
        )
      );
      
      // Close modal if open
      if (isModalOpen && selectedOrder?.id === orderId) {
        setSelectedOrder(prev => ({ ...prev, status: newStatus }));
        setIsModalOpen(false);
      }
      
      console.log(`✅ Orders: Order ${orderId} status updated to ${newStatus}`);

      // Automatically dispatch order status email notification for Packed and Delivered states
      if (['Packed', 'Delivered'].includes(newStatus)) {
        try {
          const fullOrderForEmail = {
            ...orderData,
            id: orderId,
            status: newStatus,
            statusHistory: [...(orderData.statusHistory || []), statusUpdate]
          };
          console.log(`📧 Orders: Sending automated order status email for '${newStatus}'`);
          await sendOrderStatusEmail(fullOrderForEmail, newStatus);
        } catch (emailErr) {
          console.error(`❌ Orders: Automated status change email failed for '${newStatus}':`, emailErr);
        }
      }
      // Safely call toast only if it's available
      if (typeof toast === 'object' && toast !== null && typeof toast.success === 'function') {
        toast.success(`Order ${orderData.orderId || orderId} ${newStatus.toLowerCase()} successfully`);
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error(error.message);
    } finally {
      setProcessingAction(false);
    }
  };

  const handleResendEmail = async (order) => {
    // Confirmation dialog to prevent accidental resends
    const confirmed = window.confirm(
      `Send confirmation email to ${order.userEmail}?\n\nThis will deliver a real email. Only resend if the customer did not receive the original.`
    );
    if (!confirmed) return;

    try {
      setIsResendingEmail(true);
      const user = {
        email: order.userEmail,
        displayName: order.userName || order.shippingAddress?.name || 'Customer'
      };
      const result = await resendOrderConfirmationEmail(order, user);
      if (result.success) {
        if (result.data?.deduplicated) {
          toast.info("Email was already sent recently. Please wait 60 seconds before resending.");
        } else {
          toast.success("Order confirmation email resent!");
        }
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast.error(`Failed to resend email: ${error.message}`);
    } finally {
      setIsResendingEmail(false);
    }
  };

  const handleSendNotification = async (order, type = 'status_update') => {
    try {
      setIsSendingNotification(true);
      const statusLabel = ORDER_STATUS_CONFIG[order.status]?.label || order.status;
      const result = await sendUserNotification(order.userId, {
        title: `Order Update: ${statusLabel}`,
        body: `Your order #${order.orderId || order.id} status has been updated to ${statusLabel}.`,
        link: `/account/orders/${order.id}`,
        type
      });
      if (result.success) {
        toast.success("Notification sent to user!");
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast.error(`Failed to send notification: ${error.message}`);
    } finally {
      setIsSendingNotification(false);
    }
  };

  /**
   * Add tracking information to an order (simplified approach from original code)
   * @param {Event} e - Form submit event
   */
  const addTracking = async (e) => {
    e.preventDefault();
    
    if (!selectedOrder || !shippingInfo.trackingNumber) {
      // Safely call toast only if it's available
      if (typeof toast === 'object' && toast !== null && typeof toast.error === 'function') {
        toast.error("Please enter a valid tracking code");
      }
      return;
    }
    
    console.log(`🚚 Orders: Adding tracking info for order ${selectedOrder.id}`);
    
    try {
      setProcessingAction(true);
      
      // Update order with tracking info
      const orderRef = doc(db, "orders", selectedOrder.id);
      const trackingData = {
        code: shippingInfo.trackingNumber,
        carrier: shippingInfo.carrier
      };
      
      const statusUpdate = {
        status: 'Shipped',
        timestamp: new Date().toISOString(),
        note: `Shipped with tracking code: ${shippingInfo.trackingNumber}`
      };
      
      await updateDoc(orderRef, {
        status: 'Shipped',
        tracking: trackingData,
        statusHistory: [
          ...(selectedOrder.statusHistory || []),
          statusUpdate
        ]
      });
      
      // Update local state
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === selectedOrder.id 
            ? { 
                ...order, 
                status: 'Shipped',
                tracking: trackingData,
                statusHistory: [
                  ...(order.statusHistory || []),
                  statusUpdate
                ]
              } 
            : order
        )
      );

      // Store a copy of the selected order before we reset state for triggering the Shipped email
      const shippedOrderData = {
        ...selectedOrder,
        status: 'Shipped',
        tracking: trackingData,
        statusHistory: [
          ...(selectedOrder.statusHistory || []),
          statusUpdate
        ]
      };
      
      setIsModalOpen(false);
      setSelectedOrder(null);
      setShippingInfo({ trackingNumber: '', carrier: 'IndiaPost', service: 'standard', weight: '', notes: '' });
      
      console.log(`✅ Orders: Tracking added to order ${shippedOrderData.id}`);

      // Automatically dispatch order status email notification for Shipped state
      try {
        console.log(`📧 Orders: Sending automated Shipped order status email`);
        await sendOrderStatusEmail(shippedOrderData, 'Shipped');
      } catch (emailErr) {
        console.error(`❌ Orders: Automated shipped status email failed:`, emailErr);
      }
      // Safely call toast only if it's available
      if (typeof toast === 'object' && toast !== null && typeof toast.success === 'function') {
        toast.success(`Tracking information added to order ${selectedOrder.orderId || selectedOrder.id}`);
      }
      
    } catch (error) {
      console.error("❌ Orders: Error adding tracking:", error);
      // Safely call toast only if it's available
      if (typeof toast === 'object' && toast !== null && typeof toast.error === 'function') {
        toast.error(`Failed to add tracking: ${error.message}`);
      }
    } finally {
      setProcessingAction(false);
    }
  };

  /**
   * Bulk operations management function
   * Handles bulk status updates and other bulk operations on selected orders
   * 
   * @param {string} operation - Type of bulk operation
   * @param {Object} operationData - Data for the operation
   */
  const handleBulkOperation = async (operation, operationData) => {
    if (selectedOrderIds.size === 0) {
      // Safely call toast only if it's available
      if (typeof toast === 'object' && toast !== null && typeof toast.error === 'function') {
        toast.error("Please select orders for bulk operation");
      }
      return;
    }
    
    console.log(`🔄 Orders: Performing bulk ${operation} on ${selectedOrderIds.size} orders`);
    
    // Confirm bulk operation
    const confirmed = window.confirm(
      `Are you sure you want to perform "${operation}" on ${selectedOrderIds.size} selected orders?\n\n` +
      `This action will affect multiple orders at once.`
    );
    
    if (!confirmed) {
      console.log('❌ Orders: Bulk operation cancelled by user');
      return;
    }
    
    try {
      setProcessingAction(true);
      
      // Convert Set to Array for API call
      const orderIdsArray = Array.from(selectedOrderIds);
      
      // Call the admin service for bulk operation
      const result = await AdminOrderService.bulkOperation(
        operation,
        orderIdsArray,
        operationData,
        'admin-user' // TODO: Replace with actual admin user ID
      );
      
      if (result.success) {
        // Refresh orders to reflect changes
        await fetchOrders();
        
        // Clear selection
        setSelectedOrderIds(new Set());
        setBulkOperationMode(false);
        
        console.log(`✅ Orders: Bulk operation completed. Success: ${result.successCount}, Failed: ${result.failureCount}`);
        // Safely call toast only if it's available
        if (typeof toast === 'object' && toast !== null && typeof toast.success === 'function') {
          toast.success(
            `Bulk operation completed! ${result.successCount} successful, ${result.failureCount} failed`
          );
        }
        
        // Show detailed results if there were failures
        if (result.failureCount > 0) {
          const failedOrders = result.results.filter(r => !r.success);
          console.warn('⚠️ Orders: Some bulk operations failed:', failedOrders);
        }
        
      } else {
        throw new Error(result.error || 'Bulk operation failed');
      }
    } catch (error) {
      console.error('❌ Orders: Error in bulk operation:', error);
      // Safely call toast only if it's available
      if (typeof toast === 'object' && toast !== null && typeof toast.error === 'function') {
        toast.error(`Bulk operation failed: ${error.message}`);
      }
    } finally {
      setProcessingAction(false);
    }
  };

  /**
   * Analytics data generation function
   * Generates comprehensive analytics for the current order dataset
   */
  const generateAnalytics = async () => {
    console.log('📊 Orders: Generating analytics data');
    
    try {
      setAnalyticsLoading(true);
      
      // Use current filters for analytics generation
      const analyticsFilters = {
        ...filters,
        ...(filters.dateRange.startDate && { startDate: filters.dateRange.startDate }),
        ...(filters.dateRange.endDate && { endDate: filters.dateRange.endDate })
      };
      
      const result = await AdminOrderService.getOrderAnalytics(analyticsFilters);
      
      if (result.success) {
        setAnalyticsData(result.analytics);
        setShowAnalytics(true);
        
        console.log('✅ Orders: Analytics generated successfully');
        // Safely call toast only if it's available
        if (typeof toast === 'object' && toast !== null && typeof toast.success === 'function') {
          toast.success('Analytics generated successfully');
        }
      } else {
        throw new Error(result.error || 'Failed to generate analytics');
      }
    } catch (error) {
      console.error('❌ Orders: Error generating analytics:', error);
      // Safely call toast only if it's available
      if (typeof toast === 'object' && toast !== null && typeof toast.error === 'function') {
        toast.error(`Failed to generate analytics: ${error.message}`);
      }
    } finally {
      setAnalyticsLoading(false);
    }
  };

  /**
   * Format date to display in a user-friendly way (simplified from original)
   */
  const formatDate = (dateString) => {
    try {
      const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      };
      return new Date(dateString).toLocaleDateString('en-IN', options);
    } catch (error) {
      return 'Invalid date';
    }
  };

  /**
   * Format price as currency (from original code)
   */
  const formatPrice = (price) => {
    return `₹${Number(price).toFixed(2)}`;
  };



  /**
   * Enhanced order details modal opening function
   * Sets up the modal with the selected order and appropriate mode
   * 
   * @param {Object} order - Order object to display
   * @param {string} mode - Modal mode ('view', 'edit', 'shipping')
   */
  const openOrderModal = (order, mode = 'view') => {
    console.log(`📋 Orders: Opening ${mode} modal for order ${order.id}`);
    
    setSelectedOrder(order);
    setModalMode(mode);
    setIsModalOpen(true);
    
    // Pre-populate shipping info if in shipping mode
    if (mode === 'shipping') {
      setShippingInfo({
        trackingNumber: order.tracking?.code || '',
        carrier: order.tracking?.carrier || 'IndiaPost',
        service: 'standard',
        weight: '',
        notes: ''
      });
    }
  };

  /**
   * Order selection management for bulk operations with proper error handling
   * Handles individual order selection and bulk selection
   * 
   * @param {string} orderId - Order ID to toggle selection
   * @param {boolean} isSelected - Current selection state
   */
  const toggleOrderSelection = useCallback((orderId, isSelected) => {
    try {
      // Validate inputs to prevent errors
      if (!orderId || typeof orderId !== 'string') {
        console.error('toggleOrderSelection: Invalid orderId provided:', orderId);
        return;
      }

      setSelectedOrderIds(prev => {
        // Ensure prev is a Set object, create new one if not
        const currentSet = prev instanceof Set ? prev : new Set();
        const newSet = new Set(currentSet);
        
        if (isSelected) {
          newSet.delete(orderId);
        } else {
          newSet.add(orderId);
        }
        
        return newSet;
      });
    } catch (error) {
      console.error('Error in toggleOrderSelection:', error);
      // Reset selectedOrderIds to prevent further errors
      setSelectedOrderIds(new Set());
    }
  }, []);

  /**
   * Select all visible orders for bulk operations with proper error handling
   * Toggles selection for all currently filtered orders
   */
  const selectAllOrders = useCallback(() => {
    try {
      // Ensure filteredOrders is an array and selectedOrderIds is a Set
      if (!Array.isArray(filteredOrders)) {
        console.error('selectAllOrders: filteredOrders is not an array:', filteredOrders);
        return;
      }

      if (!(selectedOrderIds instanceof Set)) {
        console.error('selectAllOrders: selectedOrderIds is not a Set:', selectedOrderIds);
        setSelectedOrderIds(new Set());
        return;
      }

      if (selectedOrderIds.size === filteredOrders.length) {
        // Deselect all
        setSelectedOrderIds(new Set());
      } else {
        // Select all visible orders
        const allOrderIds = filteredOrders
          .filter(order => order && order.id) // Ensure order exists and has id
          .map(order => order.id);
        setSelectedOrderIds(new Set(allOrderIds));
      }
    } catch (error) {
      console.error('Error in selectAllOrders:', error);
      // Reset selectedOrderIds to prevent further errors
      setSelectedOrderIds(new Set());
    }
  }, [filteredOrders, selectedOrderIds]);

  // Early return for loading state with enhanced loading UI
  if (loading && orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mb-4"></div>
        <div className="text-xl font-semibold text-gray-700 mb-2">Loading Orders</div>
        <div className="text-gray-500">Fetching the latest order information...</div>
      </div>
    );
  }

  // Early return for error state with enhanced error UI
  if (error && orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <div className="text-6xl mb-4">❌</div>
        <div className="text-xl font-semibold text-red-600 mb-2">Error Loading Orders</div>
        <div className="text-gray-600 mb-4 text-center max-w-md">{error}</div>
        <button
          onClick={fetchOrders}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Retry Loading
        </button>
      </div>
    );
  }

  // Main component render
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Toast notification container */}

      
      {/* Header Section with Title and Action Buttons */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">Order Management</h1>
            <p className="text-gray-600 text-lg mb-4">
              Manage and track all customer orders
            </p>
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                <span className="text-gray-600">Total Orders:</span>
                <span className="font-semibold text-gray-900">{formatIndianNumber(orders.length)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span className="text-gray-600">Showing:</span>
                <span className="font-semibold text-gray-900">{formatIndianNumber(filteredOrders.length)}</span>
              </div>
              {selectedOrderIds.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                  <span className="text-gray-600">Selected:</span>
                  <span className="font-semibold text-orange-600">{selectedOrderIds.size}</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-wrap gap-3">
            {/* Refresh button */}
            <button
              onClick={fetchOrders}
              disabled={loading}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                       disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200
                       flex items-center gap-2 font-medium shadow-sm"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Refreshing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </>
              )}
            </button>
            
            {/* Analytics button */}
            <button
              onClick={generateAnalytics}
              disabled={analyticsLoading}
              className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 
                       disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200
                       flex items-center gap-2 font-medium shadow-sm"
            >
              {analyticsLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Analytics
                </>
              )}
            </button>
            
            {/* Bulk operations toggle */}
            <button
              onClick={() => {
                setBulkOperationMode(!bulkOperationMode);
                setSelectedOrderIds(new Set());
              }}
              className={`px-5 py-2.5 rounded-lg transition-all duration-200 flex items-center gap-2 font-medium shadow-sm ${
                bulkOperationMode 
                  ? 'bg-orange-600 text-white hover:bg-orange-700' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              {bulkOperationMode ? 'Exit Bulk Mode' : 'Bulk Operations'}
            </button>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="mb-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-800">Filters & Search</h3>
          <button
            onClick={() => {
              setFilters({
                status: 'all',
                priority: 'all',
                searchTerm: '',
                dateRange: { startDate: '', endDate: '' },
                minAmount: '',
                carrier: 'all'
              });
            }}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
          >
            Clear All Filters
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* Status filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            >
              <option value="all">All Statuses</option>
              {Object.entries(ORDER_STATUS_CONFIG).map(([status, config]) => (
                <option key={status} value={status}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>
          
          {/* Priority filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
            <select
              value={filters.priority}
              onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            >
              <option value="all">All Priorities</option>
              {Object.entries(PRIORITY_CONFIG).map(([priority, config]) => (
                <option key={priority} value={priority}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>
          
          {/* Search input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Order ID, customer, product..."
                value={filters.searchTerm}
                onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
              <svg className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          
          {/* Start date filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
            <input
              type="date"
              value={filters.dateRange.startDate}
              onChange={(e) => setFilters(prev => ({ 
                ...prev, 
                dateRange: { ...prev.dateRange, startDate: e.target.value }
              }))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>
          
          {/* End date filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
            <input
              type="date"
              value={filters.dateRange.endDate}
              onChange={(e) => setFilters(prev => ({ 
                ...prev, 
                dateRange: { ...prev.dateRange, endDate: e.target.value }
              }))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>
          
          {/* Minimum amount filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Min Amount</label>
            <div className="relative">
              <input
                type="number"
                placeholder="0"
                value={filters.minAmount}
                onChange={(e) => setFilters(prev => ({ ...prev, minAmount: e.target.value }))}
                className="w-full p-3 pl-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
              <span className="absolute left-3 top-3.5 text-gray-400">₹</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Operations Panel */}
      {bulkOperationMode && (
        <div className="mb-8 bg-orange-50 rounded-xl border border-orange-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h3 className="text-lg font-semibold text-orange-800 mb-1">
                Bulk Operations Mode
              </h3>
              {selectedOrderIds.size > 0 && (
                <p className="text-sm text-orange-700">
                  {selectedOrderIds.size} order{selectedOrderIds.size !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>
            {selectedOrderIds.size > 0 && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleBulkOperation('update_status', { 
                    status: ORDER_STATUSES.APPROVED,
                    note: 'Bulk approval by admin'
                  })}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors font-medium"
                  disabled={processingAction}
                >
                  Bulk Approve
                </button>
                <button
                  onClick={() => handleBulkOperation('update_priority', { 
                    priority: ORDER_PRIORITIES.HIGH 
                  })}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm hover:bg-yellow-700 transition-colors font-medium"
                  disabled={processingAction}
                >
                  Set High Priority
                </button>
                <button
                  onClick={() => setSelectedOrderIds(new Set())}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700 transition-colors font-medium"
                >
                  Clear Selection
                </button>
              </div>
            )}
          </div>
          {selectedOrderIds.size === 0 && (
            <p className="text-orange-700 text-sm bg-orange-100 rounded-lg p-3">
              Select orders using the checkboxes to perform bulk operations like approval, priority updates, and more.
            </p>
          )}
        </div>
      )}

      {/* Orders Table Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {filteredOrders.length === 0 ? (
          // Empty state with helpful messaging
          <div className="p-16 text-center">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">No Orders Found</h3>
            <p className="text-gray-600 mb-6 max-w-sm mx-auto">
              {orders.length === 0 
                ? "No orders have been placed yet. Orders will appear here once customers start placing them." 
                : "No orders match your current filters. Try adjusting your search criteria."}
            </p>
            {orders.length > 0 && (
              <button
                onClick={() => setFilters({
                  status: 'all',
                  priority: 'all',
                  searchTerm: '',
                  dateRange: { startDate: '', endDate: '' },
                  minAmount: '',
                  carrier: 'all'
                })}
                className="px-4 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
              <div className={`grid gap-6 items-center font-semibold text-gray-700 text-sm uppercase tracking-wide ${
                bulkOperationMode ? 'grid-cols-8' : 'grid-cols-7'
              }`}>
                {bulkOperationMode && (
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedOrderIds.size === filteredOrders.length && filteredOrders.length > 0}
                      onChange={selectAllOrders}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span className="ml-2 text-xs">Select All</span>
                  </div>
                )}
                <div>Order Details</div>
                <div>Customer</div>
                <div>Amount</div>
                <div>Status</div>
                <div>Priority</div>
                <div>Date</div>
                <div>Actions</div>
              </div>
            </div>
            
            {/* Table Body */}
            <div className="divide-y divide-gray-100">
              {filteredOrders.map((order) => {
                // Ensure order object exists and has required properties
                if (!order || !order.id) {
                  console.warn('Orders: Skipping invalid order:', order);
                  return null;
                }

                const statusConfig = ORDER_STATUS_CONFIG[order.status] || ORDER_STATUS_CONFIG[ORDER_STATUSES.PLACED];
                const priorityConfig = PRIORITY_CONFIG[order.priority] || PRIORITY_CONFIG[ORDER_PRIORITIES.NORMAL];
                const isSelected = selectedOrderIds instanceof Set ? selectedOrderIds.has(order.id) : false;
                
                return (
                  <div 
                    key={order.id} 
                    className={`px-6 py-5 hover:bg-gray-50 transition-all duration-150 ${
                      isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                    }`}
                  >
                    <div className={`grid gap-6 items-center ${
                      bulkOperationMode ? 'grid-cols-8' : 'grid-cols-7'
                    }`}>
                      {/* Bulk selection checkbox */}
                      {bulkOperationMode && (
                        <div>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleOrderSelection(order.id, isSelected)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </div>
                      )}
                      
                      {/* Order Details Column */}
                      <div>
                        <div className="font-semibold text-gray-900 mb-1">
                          #{order.orderId || order.id}
                        </div>
                        <div className="text-sm text-gray-600 mb-1">
                          {order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? 's' : ''}
                        </div>
                        {order.tracking?.code && (
                          <div className="text-xs text-blue-600 font-mono bg-blue-50 px-2 py-1 rounded">
                            {order.tracking.code}
                          </div>
                        )}
                      </div>
                      
                      {/* Customer Information Column */}
                      <div>
                        <div className="font-medium text-gray-900 truncate mb-1">
                          {order.userName || 'Unknown Customer'}
                        </div>
                        <div className="text-sm text-gray-600 truncate">
                          {order.userEmail}
                        </div>
                      </div>
                      
                      {/* Amount Column */}
                      <div>
                        <div className="font-semibold text-gray-900 text-lg">
                          {formatPrice(getOrderTotal(order))}
                        </div>
                      </div>
                      
                      {/* Status Column */}
                      <div>
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${statusConfig.color}`}>
                          {statusConfig.label}
                        </span>
                        {order.orderAge && order.orderAge > 7 && (
                          <div className="text-xs text-red-600 mt-2 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            {order.orderAge} days old
                          </div>
                        )}
                      </div>
                      
                      {/* Priority Column */}
                      <div>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${priorityConfig.color}`}>
                          {priorityConfig.label}
                        </span>
                      </div>
                      
                      {/* Date Column */}
                      <div>
                        <div className="text-sm text-gray-900">
                          {formatDate(order.orderDate || order.createdAt)}
                        </div>
                      </div>
                      
                      {/* Actions Column */}
                      <div className="flex items-center gap-2">
                        {/* View Details Button */}
                        <button
                          onClick={() => openOrderModal(order, 'view')}
                          className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors"
                          title="View order details"
                        >
                          View Details
                        </button>
                        
                        {/* Status-specific action buttons */}
                        {order.status === ORDER_STATUSES.PLACED && (
                          <>
                            <button
                              onClick={() => updateOrderStatus(order.id, ORDER_STATUSES.APPROVED)}
                              className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors"
                              disabled={processingAction}
                              title="Approve order"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => updateOrderStatus(order.id, ORDER_STATUSES.DECLINED, {
                                reason: 'Declined by admin from order details'
                              })}
                              className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition-colors"
                              disabled={processingAction}
                              title="Decline order"
                            >
                              Decline
                            </button>
                          </>
                        )}
                        
                        {order.status === ORDER_STATUSES.APPROVED && (
                          <button
                            onClick={() => updateOrderStatus(order.id, ORDER_STATUSES.PACKED)}
                            className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors"
                            disabled={processingAction}
                            title="Mark as packed"
                          >
                            Mark Packed
                          </button>
                        )}
                        
                        {order.status === ORDER_STATUSES.PACKED && (
                          <button
                            onClick={() => openOrderModal(order, 'shipping')}
                            className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 transition-colors"
                            disabled={processingAction}
                            title="Add shipping information"
                          >
                            Add Shipping
                          </button>
                        )}
                        
                        {order.status === ORDER_STATUSES.SHIPPED && (
                          <button
                            onClick={() => updateOrderStatus(order.id, ORDER_STATUSES.DELIVERED)}
                            className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors"
                            disabled={processingAction}
                            title="Mark as delivered"
                          >
                            Mark Delivered
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Pagination & Results Summary */}
      <div className="mt-6 px-6 py-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-gray-600">
            Showing <span className="font-semibold text-gray-900">{orders.length}</span> orders
          </div>
          
          <div className="flex items-center gap-4">
            {pagination.hasMore && (
              <button
                onClick={handleLoadMore}
                disabled={loading}
                className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent"></div>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                )}
                Load More Orders
              </button>
            )}
          </div>
          
          <div className="text-sm text-gray-500">
            Page {pagination.currentPage}
          </div>
        </div>
      </div>

      {/* Order Details/Shipping Modal */}
      {isModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white rounded-t-lg">
              <h3 className="text-xl font-bold text-gray-900">
                {modalMode === 'shipping' ? (
                  'Add Shipping Information'
                ) : (
                  `Order Details - #${selectedOrder.orderId || selectedOrder.id}`
                )}
              </h3>
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  setSelectedOrder(null);
                  setModalMode('view');
                }}
                className="text-gray-400 hover:text-gray-500 p-2 rounded-full hover:bg-gray-100"
                title="Close modal"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6">
              {modalMode === 'shipping' ? (
                // Shipping Information Form
                <form onSubmit={addTracking} className="space-y-6">
                                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <h4 className="font-semibold text-blue-800 mb-2">Shipping Instructions</h4>
                    <p className="text-blue-700 text-sm">
                      Add tracking information for order <strong>#{selectedOrder.orderId}</strong>. 
                      This will automatically update the order status to "Shipped" and notify the customer.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Carrier Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Shipping Carrier *
                      </label>
                      <select
                        value={shippingInfo.carrier}
                        onChange={(e) => setShippingInfo({...shippingInfo, carrier: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      >
                        {Object.values(SHIPPING_CARRIERS).map(carrier => (
                          <option key={carrier.code} value={carrier.name}>
                            {carrier.name} ({carrier.estimatedDays.standard} days standard)
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-gray-500">
                        Select the shipping carrier for this order
                      </p>
                    </div>
                    
                    {/* Tracking Number */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tracking Number *
                      </label>
                      <input
                        type="text"
                        value={shippingInfo.trackingNumber}
                        onChange={(e) => setShippingInfo({...shippingInfo, trackingNumber: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter tracking number"
                        required
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Enter the tracking number provided by the carrier
                      </p>
                    </div>
                    
                    {/* Service Type */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Service Type
                      </label>
                      <select
                        value={shippingInfo.service}
                        onChange={(e) => setShippingInfo({...shippingInfo, service: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="standard">Standard Delivery</option>
                        <option value="express">Express Delivery</option>
                        <option value="overnight">Overnight Delivery</option>
                      </select>
                    </div>
                    
                    {/* Package Weight */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Package Weight (kg)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={shippingInfo.weight}
                        onChange={(e) => setShippingInfo({...shippingInfo, weight: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0.0"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Optional: Enter package weight for shipping records
                      </p>
                    </div>
                  </div>
                  
                  {/* Shipping Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Shipping Notes
                    </label>
                    <textarea
                      value={shippingInfo.notes}
                      onChange={(e) => setShippingInfo({...shippingInfo, notes: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows="3"
                      placeholder="Optional shipping notes or special instructions..."
                    />
                  </div>
                  
                  {/* Form Actions */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => {
                        setIsModalOpen(false);
                        setModalMode('view');
                      }}
                      className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                      disabled={processingAction}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                               disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                               flex items-center gap-2"
                      disabled={processingAction}
                    >
                      {processingAction ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                          Processing...
                        </>
                      ) : (
                        'Add Tracking & Ship'
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                // Order Details View 
                <div className="space-y-6">
                  {/* Order Summary */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Order Information Card */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <h4 className="font-semibold text-gray-800 mb-3">
                        Order Information
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Order ID:</span>
                          <span className="font-medium">{selectedOrder.orderId || selectedOrder.id}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Date:</span>
                          <span>{formatDate(selectedOrder.orderDate || selectedOrder.createdAt)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Status:</span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            ORDER_STATUS_CONFIG[selectedOrder.status]?.color || 'bg-gray-100 text-gray-800'
                          }`}>
                            {ORDER_STATUS_CONFIG[selectedOrder.status]?.icon} {selectedOrder.status}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Priority:</span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            PRIORITY_CONFIG[selectedOrder.priority || ORDER_PRIORITIES.NORMAL]?.color
                          }`}>
                            {PRIORITY_CONFIG[selectedOrder.priority || ORDER_PRIORITIES.NORMAL]?.icon} {PRIORITY_CONFIG[selectedOrder.priority || ORDER_PRIORITIES.NORMAL]?.label}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total:</span>
                          <span className="font-bold text-lg">
                            {formatPrice(getOrderTotal(selectedOrder))}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Customer Information Card */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <h4 className="font-semibold text-gray-800 mb-3">
                        Customer Information
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-gray-600">Name:</span>
                          <div className="font-medium">{selectedOrder.userName || 'N/A'}</div>
                        </div>
                        <div>
                          <span className="text-gray-600">Email:</span>
                          <div className="font-medium break-all">{selectedOrder.userEmail}</div>
                        </div>
                        {selectedOrder.userPhone && (
                          <div>
                            <span className="text-gray-600">Phone:</span>
                            <div className="font-medium">{selectedOrder.userPhone}</div>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-600">Address:</span>
                          <div className="text-xs mt-1 leading-relaxed">
                            {selectedOrder.shipping?.address ? (
                              <>
                                {selectedOrder.shipping.address.houseNo && `${selectedOrder.shipping.address.houseNo}, `}
                                {selectedOrder.shipping.address.line1 && `${selectedOrder.shipping.address.line1}, `}
                                {selectedOrder.shipping.address.line2 && `${selectedOrder.shipping.address.line2}, `}
                                <br />
                                {selectedOrder.shipping.address.city && `${selectedOrder.shipping.address.city}, `}
                                {selectedOrder.shipping.address.state && `${selectedOrder.shipping.address.state}, `}
                                {selectedOrder.shipping.address.country && `${selectedOrder.shipping.address.country} `}
                                {selectedOrder.shipping.address.pin && `- ${selectedOrder.shipping.address.pin}`}
                              </>
                            ) : (
                              'Address not available'
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Shipping & Tracking Card */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <h4 className="font-semibold text-gray-800 mb-3">
                        Shipping & Tracking
                      </h4>
                      {selectedOrder.tracking?.code ? (
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Carrier:</span>
                            <span className="font-medium">{selectedOrder.tracking.carrier}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Tracking:</span>
                            <span className="font-mono text-blue-600">{selectedOrder.tracking.code}</span>
                          </div>
                          {selectedOrder.tracking.estimatedDelivery && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Est. Delivery:</span>
                              <span>{formatDate(selectedOrder.tracking.estimatedDelivery)}</span>
                            </div>
                          )}
                          {selectedOrder.tracking.url && (
                            <div className="mt-3">
                              <a 
                                href={selectedOrder.tracking.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 underline text-sm flex items-center gap-1"
                              >
                                🔗 Track Package
                              </a>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 italic">
                          {selectedOrder.status === ORDER_STATUSES.PACKED 
                            ? "Order is ready to ship. Add tracking information to ship this order."
                            : "Tracking information not available yet."}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Order Items */}
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-3">
                      Order Items ({selectedOrder.items?.length || 0})
                    </h4>
                    <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                      <div className="grid grid-cols-5 gap-4 p-3 bg-gray-100 text-sm font-medium text-gray-700 border-b border-gray-200">
                        <div className="col-span-2">Product</div>
                        <div>Price</div>
                        <div>Quantity</div>
                        <div>Total</div>
                      </div>
                      
                      <div className="divide-y divide-gray-200">
                        {selectedOrder.items?.map((item, index) => (
                          <div key={index} className="grid grid-cols-5 gap-4 p-3 items-center text-sm">
                            <div className="col-span-2 flex items-center gap-3">
                              {item.image && (
                                <img 
                                  src={item.image} 
                                  alt={item.name} 
                                  className="w-12 h-12 object-cover border border-gray-200 rounded"
                                />
                              )}
                              <div>
                                <div className="font-medium text-gray-800">{item.name}</div>
                              </div>
                            </div>
                            <div className="text-gray-600">{formatCurrency(item.price)}</div>
                            <div className="text-gray-600">×{item.quantity}</div>
                            <div className="font-medium text-gray-800">{formatCurrency(item.price * item.quantity)}</div>
                          </div>
                        )) || (
                          <div className="p-6 text-center text-gray-500">
                            No items found for this order
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Financial Summary */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Payment Information */}
                    <div>
                      <h4 className="font-semibold text-gray-800 mb-3">
                        Payment Information
                      </h4>
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Method:</span>
                          <span className="font-medium">{selectedOrder.payment?.method || 'N/A'}</span>
                        </div>
                        
                        {selectedOrder.payment?.details?.cardType && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Card Type:</span>
                            <span className="text-gray-900">{selectedOrder.payment.details.cardType}</span>
                          </div>
                        )}
                        
                        {selectedOrder.payment?.details?.lastFour && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Card Number:</span>
                            <span className="font-mono">xxxx-xxxx-xxxx-{selectedOrder.payment.details.lastFour}</span>
                          </div>
                        )}
                        
                        {selectedOrder.payment?.details?.upiId && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">UPI ID:</span>
                            <span className="font-mono">{selectedOrder.payment.details.upiId}</span>
                          </div>
                        )}
                        
                        <div className="flex justify-between">
                          <span className="text-gray-600">Subtotal:</span>
                          <span className="text-gray-900">{formatCurrency(selectedOrder.subtotal)}</span>
                        </div>
                        
                        <div className="flex justify-between">
                          <span className="text-gray-600">Tax:</span>
                          <span className="text-gray-900">{formatCurrency(selectedOrder.tax)}</span>
                        </div>
                        
                        <div className="flex justify-between">
                          <span className="text-gray-600">Shipping:</span>
                          <span className="text-gray-900">{formatCurrency(selectedOrder.shipping?.cost || 0)}</span>
                        </div>
                        
                        <div className="flex justify-between">
                          <span className="text-gray-600 font-medium">Total:</span>
                          <span className="text-gray-900 font-bold text-lg">
                            {formatPrice(getOrderTotal(selectedOrder))}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Order Totals */}
                    <div>
                      <h4 className="font-semibold text-gray-800 mb-3">
                        Order Totals
                      </h4>
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Subtotal:</span>
                          <span>{formatCurrency(selectedOrder.financials?.subtotal || selectedOrder.subtotal || 0)}</span>
                        </div>
                        
                        <div className="flex justify-between">
                          <span className="text-gray-600">Tax:</span>
                          <span>{formatCurrency(selectedOrder.financials?.tax || selectedOrder.tax || 0)}</span>
                        </div>
                        
                        <div className="flex justify-between">
                          <span className="text-gray-600">Shipping:</span>
                          <span>{formatCurrency(selectedOrder.financials?.shipping || selectedOrder.shipping?.cost || 0)}</span>
                        </div>
                        
                        {(selectedOrder.financials?.discount || selectedOrder.discount) > 0 && (
                          <div className="flex justify-between text-green-600">
                            <span>Discount:</span>
                            <span>-{formatCurrency(selectedOrder.financials?.discount || selectedOrder.discount || 0)}</span>
                          </div>
                        )}
                        
                        <div className="border-t border-gray-300 pt-2 mt-2">
                          <div className="flex justify-between text-base font-bold">
                            <span>Total:</span>
                            <span>{formatPrice(getOrderTotal(selectedOrder))}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Status History */}
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-3">
                      Status History
                    </h4>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 max-h-64 overflow-y-auto">
                      {selectedOrder.statusHistory && selectedOrder.statusHistory.length > 0 ? (
                        <div className="space-y-3">
                          {selectedOrder.statusHistory.map((history, index) => (
                            <div key={index} className="flex items-start gap-3">
                              <div className={`w-2 h-2 rounded-full mt-1.5 ${
                                ORDER_STATUS_CONFIG[history.status]?.color?.split(' ')[0] || 'bg-gray-400'
                              }`}></div>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-1">
                                                                  <div className="font-medium text-sm text-gray-900">
                                  {history.status}
                                </div>
                                  <div className="text-xs text-gray-500 flex-shrink-0 ml-2">
                                    {formatDate(history.timestamp)}
                                  </div>
                                </div>
                                {history.note && (
                                  <div className="text-xs text-gray-600 mb-1">{history.note}</div>
                                )}
                                {history.updatedBy && (
                                  <div className="text-xs text-gray-500">
                                    Updated by: {history.updatedBy}
                                  </div>
                                )}
                                {history.metadata && Object.keys(history.metadata).length > 0 && (
                                  <div className="text-xs text-gray-400 mt-1">
                                    Additional info: {JSON.stringify(history.metadata)}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 italic text-center py-4">
                          No status history available
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Admin Actions */}
                  <div className="flex justify-end items-center pt-6 border-t border-gray-200">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleResendEmail(selectedOrder)}
                        disabled={isResendingEmail}
                        className="px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-2"
                        title="Resend order confirmation email"
                      >
                        {isResendingEmail ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        )}
                        Resend Email
                      </button>

                      <button
                        onClick={() => handleSendNotification(selectedOrder)}
                        disabled={isSendingNotification}
                        className="px-4 py-2 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors flex items-center gap-2"
                        title="Send push notification about status"
                      >
                        {isSendingNotification ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-orange-600 border-t-transparent"></div>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                          </svg>
                        )}
                        Notify User
                      </button>

                      <button
                        onClick={() => {
                          setIsModalOpen(false);
                          setSelectedOrder(null);
                        }}
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        Close
                      </button>
                      
                      {selectedOrder.status === ORDER_STATUSES.PLACED && (
                        <>
                          <button
                            onClick={() => updateOrderStatus(selectedOrder.id, ORDER_STATUSES.APPROVED)}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                            disabled={processingAction}
                          >
                            Approve Order
                          </button>
                          <button
                            onClick={() => updateOrderStatus(selectedOrder.id, ORDER_STATUSES.DECLINED)}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                            disabled={processingAction}
                          >
                            Decline Order
                          </button>
                        </>
                      )}
                      
                      {selectedOrder.status === ORDER_STATUSES.APPROVED && (
                        <button
                          onClick={() => updateOrderStatus(selectedOrder.id, ORDER_STATUSES.PACKED)}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                          disabled={processingAction}
                        >
                          Mark as Packed
                        </button>
                      )}
                      
                      {selectedOrder.status === ORDER_STATUSES.PACKED && !selectedOrder.tracking?.code && (
                        <button
                          onClick={() => setModalMode('shipping')}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                          disabled={processingAction}
                        >
                          Add Shipping
                        </button>
                      )}
                      
                      {selectedOrder.status === ORDER_STATUSES.SHIPPED && (
                        <button
                          onClick={() => updateOrderStatus(selectedOrder.id, ORDER_STATUSES.DELIVERED)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                          disabled={processingAction}
                        >
                          Mark as Delivered
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showAnalytics && analyticsData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
              <h3 className="text-xl font-bold text-gray-900">Order Analytics</h3>
              <button 
                onClick={() => setShowAnalytics(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6">
              {/* Analytics Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="text-blue-600 text-sm font-medium mb-1">Total Orders</div>
                  <div className="text-2xl font-bold text-blue-900">
                    {formatIndianNumber(analyticsData.totalOrders)}
                  </div>
                </div>
                
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="text-green-600 text-sm font-medium mb-1">Total Revenue</div>
                  <div className="text-2xl font-bold text-green-900">
                    {formatCurrency(analyticsData.totalRevenue)}
                  </div>
                </div>
                
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="text-purple-600 text-sm font-medium mb-1">Average Order Value</div>
                  <div className="text-2xl font-bold text-purple-900">
                    {formatCurrency(analyticsData.averageOrderValue)}
                  </div>
                </div>
                
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="text-orange-600 text-sm font-medium mb-1">Unique Customers</div>
                  <div className="text-2xl font-bold text-orange-900">
                    {formatIndianNumber(analyticsData.totalUniqueCustomers)}
                  </div>
                </div>
              </div>
              
              {/* Status Distribution */}
              <div className="mb-8">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Order Status Distribution</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(analyticsData.statusDistribution).map(([status, count]) => (
                    <div key={status} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <div className="text-sm text-gray-600">{status}</div>
                      <div className="text-xl font-bold text-gray-900">{count}</div>
                      <div className="text-xs text-gray-500">
                        {analyticsData.statusPercentages[status]}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Top Products */}
              <div className="mb-8">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Top Products by Quantity</h4>
                <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                  <div className="p-3 bg-gray-100 border-b border-gray-200 text-sm font-medium text-gray-700">
                    Product Performance
                  </div>
                  <div className="divide-y divide-gray-200">
                    {analyticsData.topProductsByQuantity.slice(0, 5).map((product, index) => (
                      <div key={product.productId} className="p-3 flex justify-between items-center">
                        <div>
                          <div className="font-medium text-gray-900">{product.name}</div>
                          <div className="text-xs text-gray-500">Orders: {product.orderCount}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-gray-900">Qty: {product.totalQuantity}</div>
                          <div className="text-sm text-green-600">{formatCurrency(product.totalRevenue)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Top Customers */}
              <div>
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Top Customers</h4>
                <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                  <div className="p-3 bg-gray-100 border-b border-gray-200 text-sm font-medium text-gray-700">
                    Customer Value
                  </div>
                  <div className="divide-y divide-gray-200">
                    {analyticsData.topCustomers.slice(0, 5).map((customer, index) => (
                      <div key={customer.customerId} className="p-3 flex justify-between items-center">
                        <div>
                          <div className="font-medium text-gray-900">{customer.email}</div>
                          <div className="text-xs text-gray-500">Orders: {customer.orderCount}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-gray-900">{formatCurrency(customer.totalSpent)}</div>
                          <div className="text-sm text-gray-600">Avg: {formatCurrency(customer.avgOrderValue)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Orders; 