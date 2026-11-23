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
  SHIPPING_CARRIERS,
  getOrderTotal as getOrderTotalShared
} from "../utils/orderService";
import { resendOrderConfirmationEmail, sendOrderStatusEmail } from "../utils/emailService";
import { sendUserNotification } from "../utils/notificationService";
import { formatCurrency, formatIndianNumber } from '../utils/formatUtils';
import { getItemOptionLabel } from '../utils/productOptions';

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
  const [processingOrderState, setProcessingOrderState] = useState({ id: null, status: null }); // Track current processing action
  
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
    return getOrderTotalShared(order);
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
    const refreshInterval = setInterval(() => {
      if (fetchOrdersRef.current) {
        fetchOrdersRef.current();
      }
    }, 5 * 60 * 1000);
    
    return () => {
      clearInterval(refreshInterval);
      console.log('🧹 Orders: Component unmounted, cleaning up resources');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  /**
   * Filter and Search Reactive Effects
   * Triggers database-wide queries whenever filters change
   */
  useEffect(() => {
    // Prevent fetching if search term is active, as it will be handled by the debounced search effect
    if (filters.searchTerm && filters.searchTerm.trim() !== "") {
      return;
    }
    
    console.log('🔄 Orders: Filter values changed, triggering database-wide refetch...');
    setPagination(prev => ({ ...prev, lastDoc: null, currentPage: 1 }));
    
    const refetchOnFilter = async () => {
      try {
        setLoading(true);
        const result = await AdminOrderService.getAllOrders(filters, {
          limit: pagination.limit,
          lastDoc: null
        });
        if (result.success) {
          setOrders(result.orders);
          setPagination(prev => ({
            ...prev,
            lastDoc: result.lastDoc,
            hasMore: result.hasMore,
            currentPage: 1
          }));
        }
      } catch (error) {
        console.error('❌ Orders: Error refetching on filter change:', error);
      } finally {
        setLoading(false);
      }
    };
    
    refetchOnFilter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.priority, filters.minAmount, filters.startDate, filters.endDate, filters.orderBy, filters.orderDirection]);

  // Debounced effect for search input to prevent Firestore spam
  useEffect(() => {
    if (!filters.searchTerm || filters.searchTerm.trim() === "") {
      // If search was cleared, let the main filter effect handle loading the standard list
      return;
    }
    
    const delayDebounceFn = setTimeout(async () => {
      console.log('🔍 Orders: Search query changed, running debounced database-wide query for:', filters.searchTerm);
      setPagination(prev => ({ ...prev, lastDoc: null, currentPage: 1 }));
      
      try {
        setLoading(true);
        const result = await AdminOrderService.getAllOrders(filters, {
          limit: pagination.limit,
          lastDoc: null
        });
        if (result.success) {
          setOrders(result.orders);
          setPagination(prev => ({
            ...prev,
            lastDoc: result.lastDoc,
            hasMore: result.hasMore,
            currentPage: 1
          }));
        }
      } catch (error) {
        console.error('❌ Orders: Error during search refetch:', error);
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.searchTerm]);

  /**
   * Filter application effect
   * Applies current filters to the orders list whenever filters or orders change
   */
  useEffect(() => {
    console.log('🔍 Orders: Applying filters to orders list');
    applyFilters();
  }, [orders, filters, applyFilters]);

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
      setProcessingOrderState({ id: orderId, status: newStatus });
      
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
          setProcessingAction(false);
          setProcessingOrderState({ id: null, status: null });
          return;
        }
      }
      
      // Add deliberate 2-second delay for smooth, professional action transitions
      await new Promise(resolve => setTimeout(resolve, 2000));
      
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
      setProcessingOrderState({ id: null, status: null });
    }
  };

  const handleNukeOrder = async (orderId) => {
    const confirm1 = window.confirm(
      `⚠️ WARNING: NUKING ORDER IS IRREVERSIBLE!\n\n` +
      `This will completely erase this order from the database. Neither the customer nor the admin will ever see it again.\n\n` +
      `Do you want to proceed?`
    );
    if (!confirm1) return;

    const confirm2 = window.confirm(
      `🚨 DOUBLE CONFIRMATION REQUIRED:\n\n` +
      `Are you absolutely sure you want to permanently delete order ID: ${orderId}?\n` +
      `This will also update all overall sales stats and coupon usages accordingly.`
    );
    if (!confirm2) return;

    try {
      setProcessingAction(true);
      setProcessingOrderState({ id: orderId, status: 'nuke' });

      await new Promise(resolve => setTimeout(resolve, 1500));

      const result = await AdminOrderService.nukeOrder(orderId);

      if (result.success) {
        toast.success(`Order successfully nuked and deleted completely.`);
        
        setOrders(prevOrders => prevOrders.filter(order => order.id !== orderId));
        
        if (isModalOpen && selectedOrder?.id === orderId) {
          setIsModalOpen(false);
          setSelectedOrder(null);
        }
      } else {
        throw new Error(result.error || "Failed to delete order");
      }
    } catch (err) {
      console.error("Error nuking order:", err);
      toast.error(`Nuke failed: ${err.message}`);
    } finally {
      setProcessingAction(false);
      setProcessingOrderState({ id: null, status: null });
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
        link: `/my-account/orders`,
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
      setProcessingOrderState({ id: selectedOrder.id, status: 'Shipped' });
      
      // Add deliberate 2-second delay for smooth, professional action transitions
      await new Promise(resolve => setTimeout(resolve, 2000));
      
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
      setProcessingOrderState({ id: null, status: null });
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
    return formatCurrency(price, 0);
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

  // Shared desktop grid so the header and rows stay perfectly aligned.
  const desktopGridColumns = bulkOperationMode
    ? '2.25rem minmax(150px,1.3fr) minmax(135px,1.05fr) minmax(100px,.75fr) minmax(85px,.6fr) minmax(80px,.55fr) minmax(120px,.85fr) minmax(285px,1.9fr)'
    : 'minmax(150px,1.3fr) minmax(135px,1.05fr) minmax(100px,.75fr) minmax(85px,.6fr) minmax(80px,.55fr) minmax(120px,.85fr) minmax(285px,1.9fr)';
  const desktopGridStyle = { gridTemplateColumns: desktopGridColumns, columnGap: '1rem' };

  // Main component render
  return (
    <div className="mx-auto max-w-7xl pb-2">
      {/* Toast notification container */}

      
      {/* Header Section with Title and Action Buttons */}
      <div className="mb-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <h1 className="mb-1 text-2xl font-bold tracking-tight text-gray-900 sm:mb-2 sm:text-3xl">Order Management</h1>
            <p className="mb-3 text-sm text-gray-500 sm:mb-4 sm:text-base">
              Manage and track all customer orders
            </p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                <span className="text-gray-500">Total Orders:</span>
                <span className="font-semibold text-gray-900">{formatIndianNumber(orders.length, 0)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-500"></span>
                <span className="text-gray-500">Showing:</span>
                <span className="font-semibold text-gray-900">{formatIndianNumber(filteredOrders.length, 0)}</span>
              </div>
              {selectedOrderIds.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-orange-500"></span>
                  <span className="text-gray-500">Selected:</span>
                  <span className="font-semibold text-orange-600">{selectedOrderIds.size}</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
            {/* Refresh button */}
            <button
              onClick={fetchOrders}
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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
              className="flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
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
              className={`col-span-2 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition-all duration-200 sm:col-span-1 ${
                bulkOperationMode
                  ? 'bg-orange-600 text-white hover:bg-orange-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:mb-8 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3 sm:mb-6">
          <h3 className="text-base font-semibold text-gray-800 sm:text-lg">Filters & Search</h3>
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
            className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 sm:text-sm"
          >
            Clear All Filters
          </button>
        </div>
        
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-6">
          {/* Status filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="w-full rounded-xl border border-gray-300 p-2.5 text-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:p-3"
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
              className="w-full rounded-xl border border-gray-300 p-2.5 text-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:p-3"
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
                className="w-full rounded-xl border border-gray-300 p-2.5 pl-10 text-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:p-3 sm:pl-10"
              />
              <svg className="absolute left-3 top-3 h-4 w-4 text-gray-400 sm:top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              className="w-full rounded-xl border border-gray-300 p-2.5 text-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:p-3"
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
              className="w-full rounded-xl border border-gray-300 p-2.5 text-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:p-3"
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
                className="w-full rounded-xl border border-gray-300 p-2.5 pl-8 text-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:p-3 sm:pl-8"
              />
              <span className="absolute left-3 top-3 text-gray-400 sm:top-3.5">₹</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Operations Panel */}
      {bulkOperationMode && (
        <div className="mb-6 rounded-2xl border border-orange-200 bg-orange-50 p-4 sm:mb-8 sm:p-6">
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
              <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
                <button
                  onClick={() => handleBulkOperation('update_status', { 
                    status: ORDER_STATUSES.APPROVED,
                    note: 'Bulk approval by admin'
                  })}
                  className="w-full rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50 sm:w-auto"
                  disabled={processingAction}
                >
                  Bulk Approve
                </button>
                <button
                  onClick={() => handleBulkOperation('update_priority', { 
                    priority: ORDER_PRIORITIES.HIGH 
                  })}
                  className="w-full rounded-xl bg-yellow-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-yellow-700 disabled:opacity-50 sm:w-auto"
                  disabled={processingAction}
                >
                  Set High Priority
                </button>
                <button
                  onClick={() => setSelectedOrderIds(new Set())}
                  className="w-full rounded-xl bg-gray-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-700 sm:w-auto"
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
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {filteredOrders.length === 0 ? (
          // Empty state with helpful messaging
          <div className="p-10 text-center sm:p-16">
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
            <div className="hidden border-b border-gray-200 bg-gray-50/80 px-4 py-3.5 xl:block">
              <div
                className="grid items-center text-[11px] font-semibold uppercase tracking-wider text-gray-500"
                style={desktopGridStyle}
              >
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
                <div className="text-right">Actions</div>
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
                    className={`px-4 py-4 transition-colors duration-150 hover:bg-gray-50/70 sm:px-5 sm:py-5 xl:px-4 ${
                      isSelected ? 'border-l-4 border-blue-500 bg-blue-50' : ''
                    }`}
                  >
                    {/* Desktop Layout (Hidden on Mobile) */}
                    <div
                      className="hidden items-center xl:grid"
                      style={desktopGridStyle}
                    >
                      {bulkOperationMode && (
                        <div className="flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleOrderSelection(order.id, isSelected)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </div>
                      )}

                      {/* Order Details Column */}
                      <div className="min-w-0">
                        <div className="break-words text-[13px] font-semibold leading-snug text-gray-900" title={`#${order.orderId || order.id}`}>
                          #{order.orderId || order.id}
                        </div>
                        <div className="mt-0.5 text-xs text-gray-500">
                          {order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? 's' : ''}
                        </div>
                        {order.tracking?.code && (
                          <div className="mt-1.5 inline-block max-w-full truncate rounded-md bg-blue-50 px-2 py-0.5 font-mono text-[10px] text-blue-600">
                            {order.tracking.code}
                          </div>
                        )}
                      </div>

                      {/* Customer Information Column */}
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-gray-900" title={order.userName || 'Unknown Customer'}>
                          {order.userName || 'Unknown Customer'}
                        </div>
                        <div className="truncate text-xs text-gray-500" title={order.userEmail}>
                          {order.userEmail}
                        </div>
                      </div>

                      {/* Amount Column */}
                      <div>
                        <div className="whitespace-nowrap text-base font-bold text-gray-900">
                          {formatPrice(getOrderTotal(order))}
                        </div>
                      </div>

                      {/* Status Column */}
                      <div className="min-w-0">
                        <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusConfig.color}`}>
                          {statusConfig.label}
                        </span>
                        {order.orderAge && order.orderAge > 7 && (
                          <div className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-red-600">
                            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            {order.orderAge}d old
                          </div>
                        )}
                      </div>

                      {/* Priority Column */}
                      <div>
                        <span className={`inline-flex items-center whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold ${priorityConfig.color}`}>
                          {priorityConfig.label}
                        </span>
                      </div>

                      {/* Date Column */}
                      <div className="min-w-0">
                        <div className="text-xs leading-snug text-gray-600">
                          {formatDate(order.orderDate || order.createdAt)}
                        </div>
                      </div>

                      {/* Actions Column */}
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <button
                          onClick={() => openOrderModal(order, 'view')}
                          className="whitespace-nowrap rounded-lg bg-gray-100 px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 transition-colors hover:bg-gray-200"
                          title="View order details"
                        >
                          Details
                        </button>

                        {order.status === ORDER_STATUSES.PLACED && (
                          <>
                            <button
                              onClick={() => updateOrderStatus(order.id, ORDER_STATUSES.APPROVED)}
                              className="whitespace-nowrap rounded-lg bg-green-600 px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={processingAction}
                              title="Approve order"
                            >
                              {processingOrderState.id === order.id && processingOrderState.status === ORDER_STATUSES.APPROVED ? 'Approving…' : 'Approve'}
                            </button>
                            <button
                              onClick={() => updateOrderStatus(order.id, ORDER_STATUSES.DECLINED, {
                                reason: 'Declined by admin from order details'
                              })}
                              className="whitespace-nowrap rounded-lg bg-red-600 px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={processingAction}
                              title="Decline order"
                            >
                              {processingOrderState.id === order.id && processingOrderState.status === ORDER_STATUSES.DECLINED ? 'Declining…' : 'Decline'}
                            </button>
                          </>
                        )}

                        {order.status === ORDER_STATUSES.APPROVED && (
                          <button
                            onClick={() => updateOrderStatus(order.id, ORDER_STATUSES.PACKED)}
                            className="whitespace-nowrap rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={processingAction}
                            title="Mark as packed"
                          >
                            {processingOrderState.id === order.id && processingOrderState.status === ORDER_STATUSES.PACKED ? 'Packing…' : 'Mark Packed'}
                          </button>
                        )}

                        {order.status === ORDER_STATUSES.PACKED && (
                          <button
                            onClick={() => openOrderModal(order, 'shipping')}
                            className="whitespace-nowrap rounded-lg bg-purple-600 px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={processingAction}
                            title="Add shipping information"
                          >
                            {processingOrderState.id === order.id && processingOrderState.status === 'Shipped' ? 'Shipping…' : 'Add Shipping'}
                          </button>
                        )}

                        {order.status === ORDER_STATUSES.SHIPPED && (
                          <button
                            onClick={() => updateOrderStatus(order.id, ORDER_STATUSES.DELIVERED)}
                            className="whitespace-nowrap rounded-lg bg-green-600 px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={processingAction}
                            title="Mark as delivered"
                          >
                            {processingOrderState.id === order.id && processingOrderState.status === ORDER_STATUSES.DELIVERED ? 'Delivering…' : 'Mark Delivered'}
                          </button>
                        )}

                        <button
                          onClick={() => handleNukeOrder(order.id)}
                          className="whitespace-nowrap rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={processingAction}
                          title="Nuke order (permanently delete)"
                        >
                          {processingOrderState.id === order.id && processingOrderState.status === 'nuke' ? 'Nuking…' : 'Nuke'}
                        </button>
                      </div>

                    </div>

                    {/* Mobile / tablet card layout */}
                    <div className="flex flex-col gap-4 xl:hidden">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-2.5">
                          {bulkOperationMode && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleOrderSelection(order.id, isSelected)}
                              className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          )}
                          <div className="min-w-0">
                            <div className="break-all text-sm font-bold text-slate-900">
                              #{order.orderId || order.id}
                            </div>
                            <div className="mt-1 text-[11px] font-medium text-slate-400">
                              {order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusConfig.color}`}>
                            {statusConfig.label}
                          </span>
                          <span className={`inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-[10px] font-semibold ${priorityConfig.color}`}>
                            {priorityConfig.label}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Customer</p>
                          <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">
                            {order.userName || 'Unknown Customer'}
                          </p>
                          <p className="truncate text-[11px] text-slate-500" title={order.userEmail}>
                            {order.userEmail}
                          </p>
                        </div>
                        <div className="min-w-0 text-right">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total</p>
                          <p className="mt-0.5 whitespace-nowrap text-base font-bold text-slate-900">
                            {formatPrice(getOrderTotal(order))}
                          </p>
                          <p className="text-[10px] leading-snug text-slate-500">
                            {formatDate(order.orderDate || order.createdAt)}
                          </p>
                        </div>
                      </div>

                      {order.tracking?.code && (
                        <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-500">Tracking</span>
                          <span className="truncate font-mono text-[11px] font-semibold text-blue-700">{order.tracking.code}</span>
                        </div>
                      )}

                      {order.orderAge && order.orderAge > 7 && (
                        <div className="flex items-center gap-1 text-[10px] font-semibold text-red-600">
                          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          {order.orderAge} days old — needs attention
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => openOrderModal(order, 'view')}
                          className="min-w-[7rem] flex-1 rounded-xl bg-slate-100 px-3 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200"
                        >
                          View Details
                        </button>

                        {order.status === ORDER_STATUSES.PLACED && (
                          <>
                            <button
                              onClick={() => updateOrderStatus(order.id, ORDER_STATUSES.APPROVED)}
                              className="min-w-[7rem] flex-1 rounded-xl bg-green-600 px-3 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={processingAction}
                            >
                              {processingOrderState.id === order.id && processingOrderState.status === ORDER_STATUSES.APPROVED ? 'Approving…' : 'Approve'}
                            </button>
                            <button
                              onClick={() => updateOrderStatus(order.id, ORDER_STATUSES.DECLINED, { reason: 'Declined by admin' })}
                              className="min-w-[7rem] flex-1 rounded-xl bg-red-600 px-3 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={processingAction}
                            >
                              {processingOrderState.id === order.id && processingOrderState.status === ORDER_STATUSES.DECLINED ? 'Declining…' : 'Decline'}
                            </button>
                          </>
                        )}

                        {order.status === ORDER_STATUSES.APPROVED && (
                          <button
                            onClick={() => updateOrderStatus(order.id, ORDER_STATUSES.PACKED)}
                            className="min-w-[7rem] flex-1 rounded-xl bg-indigo-600 px-3 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={processingAction}
                          >
                            {processingOrderState.id === order.id && processingOrderState.status === ORDER_STATUSES.PACKED ? 'Packing…' : 'Mark Packed'}
                          </button>
                        )}

                        {order.status === ORDER_STATUSES.PACKED && (
                          <button
                            onClick={() => openOrderModal(order, 'shipping')}
                            className="min-w-[7rem] flex-1 rounded-xl bg-purple-600 px-3 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={processingAction}
                          >
                            Add Shipping
                          </button>
                        )}

                        {order.status === ORDER_STATUSES.SHIPPED && (
                          <button
                            onClick={() => updateOrderStatus(order.id, ORDER_STATUSES.DELIVERED)}
                            className="min-w-[7rem] flex-1 rounded-xl bg-green-600 px-3 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={processingAction}
                          >
                            {processingOrderState.id === order.id && processingOrderState.status === ORDER_STATUSES.DELIVERED ? 'Delivering…' : 'Mark Delivered'}
                          </button>
                        )}

                        <button
                          onClick={() => handleNukeOrder(order.id)}
                          className="w-full rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={processingAction}
                        >
                          {processingOrderState.id === order.id && processingOrderState.status === 'nuke' ? 'Nuking…' : 'Nuke order'}
                        </button>
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
      <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 sm:mt-6 sm:px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-gray-600">
            Showing <span className="font-semibold text-gray-900">{orders.length}</span> orders
          </div>
          
          <div className="flex items-center gap-4">
            {pagination.hasMore && (
              <button
                onClick={handleLoadMore}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-6 py-2.5 font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 disabled:opacity-50 sm:w-auto"
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
        <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div className="flex h-[100dvh] w-full max-w-6xl flex-col overflow-y-auto rounded-none bg-white shadow-xl sm:h-auto sm:max-h-[90vh] sm:rounded-2xl">
            {/* Modal Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3.5 sm:px-6 sm:py-4">
              <h3 className="truncate text-base font-bold text-gray-900 sm:text-xl">
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
            
            <div className="p-4 sm:p-6">
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
                  <div className="flex flex-col-reverse gap-2 border-t border-gray-200 pt-4 sm:flex-row sm:justify-end sm:gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsModalOpen(false);
                        setModalMode('view');
                      }}
                      className="w-full rounded-xl bg-gray-200 px-6 py-2.5 font-medium text-gray-800 transition-colors hover:bg-gray-300 sm:w-auto"
                      disabled={processingAction}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
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
                    <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                      <div className="hidden grid-cols-5 gap-4 border-b border-gray-200 bg-gray-100 p-3 text-xs font-semibold uppercase tracking-wide text-gray-600 sm:grid">
                        <div className="col-span-2">Product</div>
                        <div>Price</div>
                        <div>Quantity</div>
                        <div className="text-right">Total</div>
                      </div>

                      <div className="divide-y divide-gray-200">
                        {selectedOrder.items?.map((item, index) => (
                          <div key={index} className="grid grid-cols-1 gap-2.5 p-3 text-sm sm:grid-cols-5 sm:items-center sm:gap-4">
                            <div className="flex items-center gap-3 sm:col-span-2">
                              {item.image && (
                                <img
                                  src={item.image}
                                  alt={item.name}
                                  className="h-14 w-14 shrink-0 rounded-lg border border-gray-200 bg-white object-cover"
                                />
                              )}
                              <div className="min-w-0">
                                <div className="font-semibold text-gray-800">{item.name}</div>
                                {getItemOptionLabel(item) && (
                                  <div className="mt-0.5 text-xs text-gray-500">
                                    {getItemOptionLabel(item)}
                                    {Number(item.optionPriceDelta) > 0 ? ` · +${formatCurrency(item.optionPriceDelta, 0)}` : ''}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center justify-between sm:block">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 sm:hidden">Price</span>
                              <span className="text-gray-600">{formatCurrency(item.price, 0)}</span>
                            </div>
                            <div className="flex items-center justify-between sm:block">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 sm:hidden">Qty</span>
                              <span className="text-gray-600">×{item.quantity}</span>
                            </div>
                            <div className="flex items-center justify-between sm:block sm:text-right">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 sm:hidden">Total</span>
                              <span className="font-semibold text-gray-900">{formatCurrency(item.price * item.quantity, 0)}</span>
                            </div>
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
                            {processingOrderState.id === selectedOrder.id && processingOrderState.status === ORDER_STATUSES.APPROVED ? 'Approving...' : 'Approve Order'}
                          </button>
                          <button
                            onClick={() => updateOrderStatus(selectedOrder.id, ORDER_STATUSES.DECLINED)}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                            disabled={processingAction}
                          >
                            {processingOrderState.id === selectedOrder.id && processingOrderState.status === ORDER_STATUSES.DECLINED ? 'Declining...' : 'Decline Order'}
                          </button>
                        </>
                      )}
                      
                      {selectedOrder.status === ORDER_STATUSES.APPROVED && (
                        <button
                          onClick={() => updateOrderStatus(selectedOrder.id, ORDER_STATUSES.PACKED)}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                          disabled={processingAction}
                        >
                          {processingOrderState.id === selectedOrder.id && processingOrderState.status === ORDER_STATUSES.PACKED ? 'Packing...' : 'Mark as Packed'}
                        </button>
                      )}
                      
                      {selectedOrder.status === ORDER_STATUSES.PACKED && !selectedOrder.tracking?.code && (
                        <button
                          onClick={() => setModalMode('shipping')}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                          disabled={processingAction}
                        >
                          {processingOrderState.id === selectedOrder.id && processingOrderState.status === 'Shipped' ? 'Shipping...' : 'Add Shipping'}
                        </button>
                      )}
                      
                      {selectedOrder.status === ORDER_STATUSES.SHIPPED && (
                        <button
                          onClick={() => updateOrderStatus(selectedOrder.id, ORDER_STATUSES.DELIVERED)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                          disabled={processingAction}
                        >
                          {processingOrderState.id === selectedOrder.id && processingOrderState.status === ORDER_STATUSES.DELIVERED ? 'Delivering...' : 'Mark as Delivered'}
                        </button>
                      )}
                      <button
                        onClick={() => handleNukeOrder(selectedOrder.id)}
                        className="px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors ml-auto font-semibold"
                        disabled={processingAction}
                      >
                        {processingOrderState.id === selectedOrder.id && processingOrderState.status === 'nuke' ? 'Nuking...' : 'Nuke Order'}
                      </button>
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