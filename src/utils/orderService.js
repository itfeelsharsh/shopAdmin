/**
 * Admin Order Service
 * 
 * This service provides comprehensive order management functionality specifically
 * designed for admin operations. It integrates with the main order service and
 * extends it with admin-specific features like bulk operations, analytics,
 * advanced filtering, and administrative workflow management.
 * 
 * Key Features:
 * - Complete order lifecycle management
 * - Advanced filtering and search capabilities
 * - Bulk operations for efficiency
 * - Real-time status updates
 * - Comprehensive analytics and reporting
 * - Integration with shipping carriers
 * - Email notification management
 * - Firebase security rule compliance
 * 
 * @author Shop Admin System
 * @version 2.0.0
 */

import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  startAfter,
  serverTimestamp,
  runTransaction,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Order status constants for consistent admin management
 * These align with the main application's order statuses
 */
export const ORDER_STATUSES = {
  PLACED: 'Placed',           // Initial order placement - requires admin approval
  APPROVED: 'Approved',       // Admin approved for processing
  PACKED: 'Packed',           // Order packed and ready for shipment
  SHIPPED: 'Shipped',         // Order shipped with tracking information
  DELIVERED: 'Delivered',     // Order delivered to customer
  DECLINED: 'Declined',       // Admin declined the order
  CANCELLED: 'Cancelled',     // Order cancelled (by customer or admin)
  REFUNDED: 'Refunded'        // Order refunded
};

/**
 * Priority levels for order processing
 * Used for admin queue management and processing prioritization
 */
export const ORDER_PRIORITIES = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent'
};

/**
 * Shipping carrier configuration with tracking capabilities
 * Provides standardized carrier information for shipment processing
 */
export const SHIPPING_CARRIERS = {
  INDIA_POST: {
    name: 'IndiaPost',
    code: 'INDIAPOST',
    trackingUrl: 'https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx',
    estimatedDays: { standard: 7, express: 3 }
  },
  DHL: {
    name: 'DHL',
    code: 'DHL',
    trackingUrl: 'https://www.dhl.com/in-en/home/tracking.html',
    estimatedDays: { standard: 3, express: 1 }
  },
  FEDEX: {
    name: 'FedEx',
    code: 'FEDEX',
    trackingUrl: 'https://www.fedex.com/en-in/tracking.html',
    estimatedDays: { standard: 3, express: 1 }
  },
  BLUEDART: {
    name: 'BlueDart',
    code: 'BLUEDART',
    trackingUrl: 'https://www.bluedart.com/web/guest/trackdartresult',
    estimatedDays: { standard: 2, express: 1 }
  }
};

/**
 * Comprehensive admin service class for order management
 * Provides all necessary functionality for admin order operations
 */
class AdminOrderService {
  
  /**
   * Simple test method to check Firestore connection and data structure
   * @returns {Promise<Object>} - Test results
   */
  static async testFirestoreConnection() {
    console.log('🧪 AdminOrderService: Testing Firestore connection...');
    
    try {
      // Try to get just one document from the orders collection
      const ordersRef = collection(db, "orders");
      const snapshot = await getDocs(query(ordersRef, limit(1)));
      
      console.log('🧪 AdminOrderService: Connection test results:', {
        connected: true,
        documentsFound: snapshot.docs.length,
        sampleData: snapshot.docs.length > 0 ? snapshot.docs[0].data() : null
      });
      
      return {
        success: true,
        connected: true,
        documentsFound: snapshot.docs.length,
        sampleData: snapshot.docs.length > 0 ? snapshot.docs[0].data() : null
      };
    } catch (error) {
      console.error('🧪 AdminOrderService: Connection test failed:', error);
      return {
        success: false,
        connected: false,
        error: error.message
      };
    }
  }
  
  /**
   * Simple method to get all orders without any filters or complex logic
   * @returns {Promise<Object>} - Simple order retrieval
   */
  static async getSimpleOrders() {
    console.log('🧪 AdminOrderService: Getting orders with simple query...');
    
    try {
      const ordersRef = collection(db, "orders");
      const snapshot = await getDocs(ordersRef);
      
      const orders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log(`🧪 AdminOrderService: Simple query returned ${orders.length} orders`);
      
      return {
        success: true,
        orders: orders,
        totalCount: orders.length
      };
    } catch (error) {
      console.error('🧪 AdminOrderService: Simple query failed:', error);
      return {
        success: false,
        error: error.message,
        orders: [],
        totalCount: 0
      };
    }
  }
  
  /**
   * Fetch all orders with advanced filtering and pagination
   * This method provides flexible order retrieval with multiple filter options
   * for efficient admin order management and analysis
   * 
   * @param {Object} filters - Comprehensive filter options
   * @param {Object} pagination - Pagination configuration
   * @returns {Promise<Object>} - Orders with metadata and pagination info
   */
  static async getAllOrders(filters = {}, pagination = {}) {
    console.log('🔍 AdminOrderService: Fetching orders with filters:', filters);
    
    try {
      let ordersQuery = collection(db, "orders");
      console.log('🔍 AdminOrderService: Initial query created for collection "orders"');
      
      // Apply status filter for order workflow management
      if (filters.status && filters.status !== 'all') {
        ordersQuery = query(ordersQuery, where("status", "==", filters.status));
      }
      
      // Apply user/customer filter for customer-specific order management
      if (filters.userId) {
        ordersQuery = query(ordersQuery, where("userId", "==", filters.userId));
      }
      
      // Apply email filter for customer lookup
      if (filters.userEmail) {
        ordersQuery = query(ordersQuery, where("userEmail", "==", filters.userEmail));
      }
      
      // Apply date range filters for time-based analysis
      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        ordersQuery = query(ordersQuery, where("createdAt", ">=", startDate));
      }
      
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999); // End of day
        ordersQuery = query(ordersQuery, where("createdAt", "<=", endDate));
      }
      
      // Apply priority filter for workflow management
      if (filters.priority && filters.priority !== 'all') {
        ordersQuery = query(ordersQuery, where("priority", "==", filters.priority));
      }
      
      // Apply minimum amount filter for high-value order tracking
      if (filters.minAmount) {
        ordersQuery = query(ordersQuery, where("total", ">=", parseFloat(filters.minAmount)));
      }
      
      // Apply ordering for consistent data presentation
      const orderField = filters.orderBy || "createdAt";
      const orderDirection = filters.orderDirection || "desc";
      
      // Try to apply ordering, but catch errors in case the field doesn't exist
      try {
        ordersQuery = query(ordersQuery, orderBy(orderField, orderDirection));
        console.log(`🔍 AdminOrderService: Applied ordering by ${orderField} ${orderDirection}`);
      } catch (orderError) {
        console.warn(`⚠️ AdminOrderService: Could not order by ${orderField}, using no ordering:`, orderError);
        // Continue with query without ordering
      }
      
      // Apply pagination for performance optimization
      if (pagination.limit) {
        ordersQuery = query(ordersQuery, limit(pagination.limit));
        
        // Handle pagination cursor for large datasets
        if (pagination.lastDoc) {
          ordersQuery = query(ordersQuery, startAfter(pagination.lastDoc));
        }
      }
      
      // Execute the query and transform results
      console.log('🔍 AdminOrderService: Executing Firestore query...');
      const ordersSnapshot = await getDocs(ordersQuery);
      console.log(`🔍 AdminOrderService: Raw query returned ${ordersSnapshot.docs.length} documents`);
      
      if (ordersSnapshot.docs.length > 0) {
        console.log('🔍 AdminOrderService: Sample document data:', ordersSnapshot.docs[0].data());
      }
      
      const orders = ordersSnapshot.docs.map(doc => {
        const data = doc.data();
        console.log(`🔍 AdminOrderService: Processing document ${doc.id}:`, data);
        
        // Handle different date field formats
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
        
        return {
          id: doc.id,
          ...data,
          // Ensure consistent data structure for admin interface
          total: data.financials?.total || data.total || data.amount || 0,
          subtotal: data.financials?.subtotal || data.subtotal || 0,
          orderDate: orderDate,
          // Calculate order age for processing prioritization
          orderAge: orderDate ? 
            Math.floor((new Date() - orderDate) / (1000 * 60 * 60 * 24)) : 0
        };
      });
      
      // Apply client-side filters that can't be done in Firestore
      let filteredOrders = orders;
      
      // Search functionality for order ID, customer name, or product names
      if (filters.searchTerm) {
        const searchTerm = filters.searchTerm.toLowerCase();
        filteredOrders = orders.filter(order => {
          return (
            order.orderId?.toLowerCase().includes(searchTerm) ||
            order.userName?.toLowerCase().includes(searchTerm) ||
            order.userEmail?.toLowerCase().includes(searchTerm) ||
            order.items?.some(item => 
              item.name?.toLowerCase().includes(searchTerm)
            )
          );
        });
      }
      
      console.log(`✅ AdminOrderService: Retrieved ${filteredOrders.length} orders`);
      
      return {
        success: true,
        orders: filteredOrders,
        totalCount: filteredOrders.length,
        lastDoc: ordersSnapshot.docs[ordersSnapshot.docs.length - 1] || null,
        hasMore: ordersSnapshot.docs.length === (pagination.limit || 0)
      };
    } catch (error) {
      console.error('❌ AdminOrderService: Error fetching orders:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch orders',
        orders: [],
        totalCount: 0
      };
    }
  }
  
  /**
   * Update order status with comprehensive admin tracking
   * This method handles status changes with full audit trail and notification support
   * 
   * @param {string} orderId - Order ID to update
   * @param {string} newStatus - New status from ORDER_STATUSES
   * @param {Object} updateInfo - Additional update information
   * @param {string} adminUserId - Admin user performing the update
   * @returns {Promise<Object>} - Update result with comprehensive feedback
   */
  static async updateOrderStatus(orderId, newStatus, updateInfo = {}, adminUserId = 'admin') {
    console.log(`🔄 AdminOrderService: Updating order ${orderId} to status ${newStatus}`);
    
    try {
      // Validate the new status against allowed values
      if (!Object.values(ORDER_STATUSES).includes(newStatus)) {
        throw new Error(`Invalid order status: ${newStatus}. Must be one of: ${Object.values(ORDER_STATUSES).join(', ')}`);
      }
      
      // Get current order data for validation and history tracking
      const orderRef = doc(db, "orders", orderId);
      const orderSnapshot = await getDoc(orderRef);
      
      if (!orderSnapshot.exists()) {
        throw new Error(`Order with ID ${orderId} not found in database`);
      }
      
      const currentOrder = orderSnapshot.data();
      const currentStatus = currentOrder.status;
      
      // Validate status transition according to business rules
      const validTransitions = {
        [ORDER_STATUSES.PLACED]: [ORDER_STATUSES.APPROVED, ORDER_STATUSES.DECLINED, ORDER_STATUSES.CANCELLED],
        [ORDER_STATUSES.APPROVED]: [ORDER_STATUSES.PACKED, ORDER_STATUSES.CANCELLED],
        [ORDER_STATUSES.PACKED]: [ORDER_STATUSES.SHIPPED, ORDER_STATUSES.CANCELLED],
        [ORDER_STATUSES.SHIPPED]: [ORDER_STATUSES.DELIVERED],
        [ORDER_STATUSES.DELIVERED]: [ORDER_STATUSES.REFUNDED],
        [ORDER_STATUSES.DECLINED]: [], // Terminal state
        [ORDER_STATUSES.CANCELLED]: [ORDER_STATUSES.REFUNDED],
        [ORDER_STATUSES.REFUNDED]: [] // Terminal state
      };
      
      // Check if transition is valid (with admin override capability)
      if (validTransitions[currentStatus] && !validTransitions[currentStatus].includes(newStatus)) {
        console.warn(`⚠️ AdminOrderService: Potentially invalid status transition from ${currentStatus} to ${newStatus}`);
        // Continue anyway - admin has override capability
      }
      
      // Create comprehensive status history entry
      const statusHistoryEntry = {
        status: newStatus,
        timestamp: new Date().toISOString(),
        note: updateInfo.note || `Order ${newStatus.toLowerCase()} by admin`,
        updatedBy: adminUserId,
        previousStatus: currentStatus,
        adminNotes: updateInfo.adminNotes || '',
        metadata: {
          updateReason: updateInfo.reason || 'Status change',
          ipAddress: updateInfo.ipAddress || 'unknown',
          userAgent: updateInfo.userAgent || 'admin-panel',
          ...updateInfo.metadata
        }
      };
      
      // Prepare comprehensive update data
      const updateData = {
        status: newStatus,
        updatedAt: serverTimestamp(),
        lastUpdatedBy: adminUserId,
        statusHistory: [...(currentOrder.statusHistory || []), statusHistoryEntry]
      };
      
      // Add status-specific fields and business logic
      switch (newStatus) {
        case ORDER_STATUSES.APPROVED:
          updateData.approvedAt = serverTimestamp();
          updateData.approvedBy = adminUserId;
          updateData.priority = updateInfo.priority || currentOrder.priority || ORDER_PRIORITIES.NORMAL;
          break;
          
        case ORDER_STATUSES.PACKED:
          updateData.packedAt = serverTimestamp();
          updateData.packedBy = adminUserId;
          updateData.packingNotes = updateInfo.packingNotes || '';
          // Auto-assign carrier based on shipping address
          if (!currentOrder.tracking?.carrier) {
            const isInternational = currentOrder.shipping?.address?.country !== 'India';
            updateData.tracking = {
              ...currentOrder.tracking,
              carrier: isInternational ? SHIPPING_CARRIERS.DHL.name : SHIPPING_CARRIERS.INDIA_POST.name
            };
          }
          break;
          
        case ORDER_STATUSES.SHIPPED:
          updateData.shippedAt = serverTimestamp();
          updateData.shippedBy = adminUserId;
          // Tracking information should be provided separately via updateShippingInfo
          if (updateInfo.tracking) {
            updateData.tracking = {
              ...currentOrder.tracking,
              ...updateInfo.tracking,
              shippedDate: new Date().toISOString()
            };
          }
          break;
          
        case ORDER_STATUSES.DELIVERED:
          updateData.deliveredAt = serverTimestamp();
          updateData.deliveryConfirmation = updateInfo.deliveryConfirmation || 'Admin marked as delivered';
          break;
          
        case ORDER_STATUSES.DECLINED:
          updateData.declinedAt = serverTimestamp();
          updateData.declinedBy = adminUserId;
          updateData.declineReason = updateInfo.reason || 'Order declined by admin';
          // Restore inventory on decline
          await this.restoreInventory(currentOrder.items);
          break;
          
        case ORDER_STATUSES.CANCELLED:
          updateData.cancelledAt = serverTimestamp();
          updateData.cancelledBy = adminUserId;
          updateData.cancellationReason = updateInfo.reason || 'Order cancelled';
          // Restore inventory on cancellation
          await this.restoreInventory(currentOrder.items);
          break;
          
        case ORDER_STATUSES.REFUNDED:
          updateData.refundedAt = serverTimestamp();
          updateData.refundedBy = adminUserId;
          updateData.refundAmount = updateInfo.refundAmount || currentOrder.total;
          updateData.refundReason = updateInfo.reason || 'Refund processed';
          updateData.refundMethod = updateInfo.refundMethod || 'original_payment_method';
          break;
          
        default:
          // For any other status, just update the basic fields
          console.log(`📝 AdminOrderService: Using default handling for status ${newStatus}`);
          break;
      }
      
      // Use transaction to ensure data consistency across collections
      await runTransaction(db, async (transaction) => {
        // Update main order document
        transaction.update(orderRef, updateData);
        
        // Synchronize user's order collection if user exists
        if (currentOrder.userId) {
          try {
            // Find user's order document (may have different ID structure)
            const userOrdersQuery = query(
              collection(db, "users", currentOrder.userId, "orders"),
              where("globalOrderId", "==", orderId)
            );
            const userOrdersSnapshot = await getDocs(userOrdersQuery);
            
            userOrdersSnapshot.forEach(userOrderDoc => {
              transaction.update(userOrderDoc.ref, updateData);
            });
          } catch (userUpdateError) {
            console.warn('⚠️ AdminOrderService: Could not update user order collection:', userUpdateError);
            // Continue - main order update is more important
          }
        }
      });
      
      console.log(`✅ AdminOrderService: Order ${orderId} status updated from ${currentStatus} to ${newStatus}`);
      
      // Return comprehensive update result
      return {
        success: true,
        message: `Order status successfully updated to ${newStatus}`,
        orderId: orderId,
        previousStatus: currentStatus,
        newStatus: newStatus,
        timestamp: statusHistoryEntry.timestamp,
        updateData: updateData
      };
      
    } catch (error) {
      console.error('❌ AdminOrderService: Error updating order status:', error);
      return {
        success: false,
        error: error.message || 'Failed to update order status',
        orderId: orderId
      };
    }
  }
  
  /**
   * Add or update shipping information for an order
   * This method handles comprehensive shipping data management including tracking
   * 
   * @param {string} orderId - Order ID to update
   * @param {Object} shippingInfo - Complete shipping information
   * @param {string} adminUserId - Admin user adding shipping info
   * @returns {Promise<Object>} - Shipping update result
   */
  static async updateShippingInfo(orderId, shippingInfo, adminUserId = 'admin') {
    console.log(`🚚 AdminOrderService: Updating shipping info for order ${orderId}`);
    
    try {
      // Validate required shipping information
      if (!shippingInfo.trackingNumber) {
        throw new Error('Tracking number is required for shipping updates');
      }
      
      if (!shippingInfo.carrier) {
        throw new Error('Shipping carrier is required for shipping updates');
      }
      
      // Get current order data
      const orderRef = doc(db, "orders", orderId);
      const orderSnapshot = await getDoc(orderRef);
      
      if (!orderSnapshot.exists()) {
        throw new Error(`Order ${orderId} not found`);
      }
      
      const currentOrder = orderSnapshot.data();
      
      // Validate order can be shipped
      if (currentOrder.status !== ORDER_STATUSES.PACKED) {
        // Allow shipping info to be added/updated for already shipped orders
        if (currentOrder.status !== ORDER_STATUSES.SHIPPED) {
          throw new Error(`Order must be in ${ORDER_STATUSES.PACKED} or ${ORDER_STATUSES.SHIPPED} status to update shipping info. Current status: ${currentOrder.status}`);
        }
      }
      
      // Find carrier configuration
      const carrierConfig = Object.values(SHIPPING_CARRIERS).find(carrier => 
        carrier.name.toLowerCase() === shippingInfo.carrier.toLowerCase() ||
        carrier.code.toLowerCase() === shippingInfo.carrier.toLowerCase()
      );
      
      if (!carrierConfig) {
        console.warn(`⚠️ AdminOrderService: Unknown carrier ${shippingInfo.carrier}, using provided data`);
      }
      
      // Calculate estimated delivery date
      const estimatedDeliveryDate = new Date();
      const deliveryDays = carrierConfig?.estimatedDays?.standard || 7;
      estimatedDeliveryDate.setDate(estimatedDeliveryDate.getDate() + deliveryDays);
      
      // Prepare comprehensive tracking data
      const trackingData = {
        code: shippingInfo.trackingNumber,
        carrier: carrierConfig?.name || shippingInfo.carrier,
        carrierCode: carrierConfig?.code || shippingInfo.carrier.toUpperCase(),
        url: carrierConfig?.trackingUrl || null,
        estimatedDelivery: estimatedDeliveryDate.toISOString(),
        shippedDate: new Date().toISOString(),
        service: shippingInfo.service || 'standard',
        weight: shippingInfo.weight || null,
        dimensions: shippingInfo.dimensions || null,
        cost: shippingInfo.shippingCost || currentOrder.shipping?.cost || 0,
        notes: shippingInfo.notes || '',
        updatedBy: adminUserId,
        updatedAt: new Date().toISOString()
      };
      
      // Create status update for shipping
      const statusUpdate = {
        status: ORDER_STATUSES.SHIPPED,
        timestamp: new Date().toISOString(),
        note: `Order shipped via ${trackingData.carrier} with tracking number ${trackingData.code}`,
        updatedBy: adminUserId,
        metadata: {
          trackingNumber: trackingData.code,
          carrier: trackingData.carrier,
          estimatedDelivery: trackingData.estimatedDelivery
        }
      };
      
      // Prepare update data
      const updateData = {
        status: ORDER_STATUSES.SHIPPED,
        tracking: trackingData,
        shippedAt: serverTimestamp(),
        shippedBy: adminUserId,
        updatedAt: serverTimestamp(),
        statusHistory: [...(currentOrder.statusHistory || []), statusUpdate]
      };
      
      // Update the order
      await updateDoc(orderRef, updateData);
      
      console.log(`✅ AdminOrderService: Shipping info updated for order ${orderId}`);
      
      return {
        success: true,
        message: 'Shipping information updated successfully',
        orderId: orderId,
        trackingNumber: trackingData.code,
        carrier: trackingData.carrier,
        estimatedDelivery: trackingData.estimatedDelivery,
        trackingUrl: trackingData.url
      };
      
    } catch (error) {
      console.error('❌ AdminOrderService: Error updating shipping info:', error);
      return {
        success: false,
        error: error.message || 'Failed to update shipping information'
      };
    }
  }
  
  /**
   * Perform bulk operations on multiple orders
   * This method provides efficient batch processing for admin operations
   * 
   * @param {string} operation - Type of bulk operation (update_status, update_priority, etc.)
   * @param {Array} orderIds - Array of order IDs to process
   * @param {Object} operationData - Data for the operation
   * @param {string} adminUserId - Admin user performing the operation
   * @returns {Promise<Object>} - Bulk operation results
   */
  static async bulkOperation(operation, orderIds, operationData, adminUserId = 'admin') {
    console.log(`🔄 AdminOrderService: Performing bulk ${operation} on ${orderIds.length} orders`);
    
    try {
      if (!orderIds || orderIds.length === 0) {
        throw new Error('No order IDs provided for bulk operation');
      }
      
      if (orderIds.length > 50) {
        throw new Error('Bulk operations are limited to 50 orders at a time for performance reasons');
      }
      
      const results = [];
      const batch = writeBatch(db);
      
      // Process each order in the bulk operation
      for (const orderId of orderIds) {
        try {
          const orderRef = doc(db, "orders", orderId);
          const orderSnapshot = await getDoc(orderRef);
          
          if (!orderSnapshot.exists()) {
            results.push({
              orderId: orderId,
              success: false,
              error: 'Order not found'
            });
            continue;
          }
          
          const currentOrder = orderSnapshot.data();
          let updateData = {};
          
          // Determine update data based on operation type
          switch (operation) {
            case 'update_status':
              if (!Object.values(ORDER_STATUSES).includes(operationData.status)) {
                results.push({
                  orderId: orderId,
                  success: false,
                  error: `Invalid status: ${operationData.status}`
                });
                continue;
              }
              
              updateData = {
                status: operationData.status,
                updatedAt: serverTimestamp(),
                lastUpdatedBy: adminUserId,
                statusHistory: [...(currentOrder.statusHistory || []), {
                  status: operationData.status,
                  timestamp: new Date().toISOString(),
                  note: operationData.note || `Bulk status update to ${operationData.status}`,
                  updatedBy: adminUserId,
                  metadata: { bulkOperation: true }
                }]
              };
              break;
              
            case 'update_priority':
              if (!Object.values(ORDER_PRIORITIES).includes(operationData.priority)) {
                results.push({
                  orderId: orderId,
                  success: false,
                  error: `Invalid priority: ${operationData.priority}`
                });
                continue;
              }
              
              updateData = {
                priority: operationData.priority,
                updatedAt: serverTimestamp(),
                lastUpdatedBy: adminUserId
              };
              break;
              
            case 'add_tag':
              const currentTags = currentOrder.tags || [];
              if (!currentTags.includes(operationData.tag)) {
                updateData = {
                  tags: [...currentTags, operationData.tag],
                  updatedAt: serverTimestamp(),
                  lastUpdatedBy: adminUserId
                };
              }
              break;
              
            case 'remove_tag':
              const tagsToKeep = (currentOrder.tags || []).filter(tag => tag !== operationData.tag);
              updateData = {
                tags: tagsToKeep,
                updatedAt: serverTimestamp(),
                lastUpdatedBy: adminUserId
              };
              break;
              
            case 'add_admin_note':
              updateData = {
                adminNotes: (currentOrder.adminNotes || '') + '\n' + operationData.note,
                updatedAt: serverTimestamp(),
                lastUpdatedBy: adminUserId
              };
              break;
              
            default:
              results.push({
                orderId: orderId,
                success: false,
                error: `Unknown operation: ${operation}`
              });
              continue;
          }
          
          // Add to batch if we have valid update data
          if (Object.keys(updateData).length > 0) {
            batch.update(orderRef, updateData);
            results.push({
              orderId: orderId,
              success: true,
              operation: operation
            });
          }
          
        } catch (orderError) {
          results.push({
            orderId: orderId,
            success: false,
            error: orderError.message
          });
        }
      }
      
      // Commit the batch operation
      await batch.commit();
      
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;
      
      console.log(`✅ AdminOrderService: Bulk operation completed. Success: ${successCount}, Failed: ${failureCount}`);
      
      return {
        success: true,
        operation: operation,
        totalOrders: orderIds.length,
        successCount: successCount,
        failureCount: failureCount,
        results: results
      };
      
    } catch (error) {
      console.error('❌ AdminOrderService: Error in bulk operation:', error);
      return {
        success: false,
        error: error.message || 'Failed to perform bulk operation',
        operation: operation
      };
    }
  }
  
  /**
   * Generate comprehensive order analytics for admin dashboard
   * This method provides detailed insights into order patterns and performance
   * 
   * @param {Object} filters - Time range and filter criteria
   * @returns {Promise<Object>} - Comprehensive analytics data
   */
  static async getOrderAnalytics(filters = {}) {
    console.log('📊 AdminOrderService: Generating order analytics');
    
    try {
      // Fetch orders based on filters
      const ordersResult = await this.getAllOrders(filters);
      
      if (!ordersResult.success) {
        throw new Error(ordersResult.error);
      }
      
      const orders = ordersResult.orders;
      
      // Calculate basic metrics
      const totalOrders = orders.length;
      const totalRevenue = orders.reduce((sum, order) => {
        const orderTotal = order.financials?.total || order.total || 0;
        return sum + orderTotal;
      }, 0);
      
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      
      // Status distribution analysis
      const statusDistribution = orders.reduce((acc, order) => {
        const status = order.status || 'Unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});
      
      // Calculate status percentages
      const statusPercentages = {};
      Object.keys(statusDistribution).forEach(status => {
        statusPercentages[status] = totalOrders > 0 ? 
          ((statusDistribution[status] / totalOrders) * 100).toFixed(1) : 0;
      });
      
      // Revenue by status
      const revenueByStatus = orders.reduce((acc, order) => {
        const status = order.status || 'Unknown';
        const revenue = order.financials?.total || order.total || 0;
        acc[status] = (acc[status] || 0) + revenue;
        return acc;
      }, {});
      
      // Product analysis
      const productAnalysis = {};
      orders.forEach(order => {
        order.items?.forEach(item => {
          if (!productAnalysis[item.productId]) {
            productAnalysis[item.productId] = {
              name: item.name,
              totalQuantity: 0,
              totalRevenue: 0,
              orderCount: 0
            };
          }
          
          productAnalysis[item.productId].totalQuantity += item.quantity;
          productAnalysis[item.productId].totalRevenue += (item.price * item.quantity);
          productAnalysis[item.productId].orderCount += 1;
        });
      });
      
      // Top products by various metrics
      const topProductsByQuantity = Object.entries(productAnalysis)
        .sort(([,a], [,b]) => b.totalQuantity - a.totalQuantity)
        .slice(0, 10)
        .map(([productId, data]) => ({ productId, ...data }));
      
      const topProductsByRevenue = Object.entries(productAnalysis)
        .sort(([,a], [,b]) => b.totalRevenue - a.totalRevenue)
        .slice(0, 10)
        .map(([productId, data]) => ({ productId, ...data }));
      
      // Time-based analysis (if date filters are provided)
      let dailyStats = null;
      if (filters.startDate && filters.endDate) {
        dailyStats = this.calculateDailyStats(orders, filters.startDate, filters.endDate);
      }
      
      // Customer analysis
      const customerAnalysis = orders.reduce((acc, order) => {
        const customerId = order.userId || 'guest';
        const customerEmail = order.userEmail || 'unknown';
        
        if (!acc[customerId]) {
          acc[customerId] = {
            email: customerEmail,
            orderCount: 0,
            totalSpent: 0,
            avgOrderValue: 0
          };
        }
        
        acc[customerId].orderCount += 1;
        acc[customerId].totalSpent += (order.financials?.total || order.total || 0);
        acc[customerId].avgOrderValue = acc[customerId].totalSpent / acc[customerId].orderCount;
        
        return acc;
      }, {});
      
      // Top customers by value
      const topCustomers = Object.entries(customerAnalysis)
        .sort(([,a], [,b]) => b.totalSpent - a.totalSpent)
        .slice(0, 10)
        .map(([customerId, data]) => ({ customerId, ...data }));
      
      // Payment method analysis
      const paymentMethodStats = orders.reduce((acc, order) => {
        const method = order.payment?.method || 'Unknown';
        acc[method] = (acc[method] || 0) + 1;
        return acc;
      }, {});
      
      // Shipping analysis
      const shippingStats = orders.reduce((acc, order) => {
        const carrier = order.tracking?.carrier || 'Not shipped';
        acc[carrier] = (acc[carrier] || 0) + 1;
        return acc;
      }, {});
      
      // Priority distribution
      const priorityStats = orders.reduce((acc, order) => {
        const priority = order.priority || ORDER_PRIORITIES.NORMAL;
        acc[priority] = (acc[priority] || 0) + 1;
        return acc;
      }, {});
      
      console.log(`✅ AdminOrderService: Analytics generated for ${totalOrders} orders`);
      
      return {
        success: true,
        analytics: {
          // Basic metrics
          totalOrders,
          totalRevenue,
          averageOrderValue,
          
          // Status analysis
          statusDistribution,
          statusPercentages,
          revenueByStatus,
          
          // Product insights
          topProductsByQuantity,
          topProductsByRevenue,
          totalUniqueProducts: Object.keys(productAnalysis).length,
          
          // Customer insights
          topCustomers,
          totalUniqueCustomers: Object.keys(customerAnalysis).length,
          
          // Operational insights
          paymentMethodStats,
          shippingStats,
          priorityStats,
          
          // Time-based data
          dailyStats,
          
          // Generated metadata
          generatedAt: new Date().toISOString(),
          dataRange: {
            startDate: filters.startDate || null,
            endDate: filters.endDate || null
          }
        }
      };
      
    } catch (error) {
      console.error('❌ AdminOrderService: Error generating analytics:', error);
      return {
        success: false,
        error: error.message || 'Failed to generate analytics'
      };
    }
  }
  
  /**
   * Calculate daily statistics for time-series analysis
   * Helper method for analytics generation
   * 
   * @param {Array} orders - Orders array
   * @param {string} startDate - Start date string
   * @param {string} endDate - End date string
   * @returns {Array} - Daily statistics array
   */
  static calculateDailyStats(orders, startDate, endDate) {
    const dailyStats = {};
    
    // Initialize date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dateKey = date.toISOString().split('T')[0];
      dailyStats[dateKey] = {
        date: dateKey,
        orderCount: 0,
        revenue: 0,
        statusBreakdown: {}
      };
    }
    
    // Aggregate order data by day
    orders.forEach(order => {
      const orderDate = order.createdAt?.toDate?.() || new Date(order.orderDate);
      const dateKey = orderDate.toISOString().split('T')[0];
      
      if (dailyStats[dateKey]) {
        dailyStats[dateKey].orderCount += 1;
        dailyStats[dateKey].revenue += (order.financials?.total || order.total || 0);
        
        const status = order.status || 'Unknown';
        dailyStats[dateKey].statusBreakdown[status] = 
          (dailyStats[dateKey].statusBreakdown[status] || 0) + 1;
      }
    });
    
    return Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date));
  }
  
  /**
   * Restore inventory for cancelled or declined orders
   * Helper method for inventory management
   * 
   * @param {Array} orderItems - Array of order items
   * @returns {Promise<void>}
   */
  static async restoreInventory(orderItems) {
    console.log('📦 AdminOrderService: Restoring inventory for cancelled/declined order');
    
    try {
      const batch = writeBatch(db);
      
      for (const item of orderItems) {
        const productRef = doc(db, "products", item.productId);
        const productSnapshot = await getDoc(productRef);
        
        if (productSnapshot.exists()) {
          const currentStock = productSnapshot.data().stock || 0;
          const restoredStock = currentStock + item.quantity;
          
          batch.update(productRef, {
            stock: restoredStock,
            lastRestored: serverTimestamp()
          });
          
          console.log(`📦 AdminOrderService: Restored ${item.quantity} units of ${item.name} (${currentStock} → ${restoredStock})`);
        }
      }
      
      await batch.commit();
      console.log('✅ AdminOrderService: Inventory restoration completed');
      
    } catch (error) {
      console.error('❌ AdminOrderService: Error restoring inventory:', error);
      throw error;
    }
  }
  
  /**
   * Get order processing queue with priority sorting
   * This method provides a prioritized view of orders for efficient processing
   * 
   * @param {Object} filters - Additional filters for queue management
   * @returns {Promise<Object>} - Prioritized order queue
   */
  static async getProcessingQueue(filters = {}) {
    console.log('📋 AdminOrderService: Generating order processing queue');
    
    try {
      // Get orders that need processing (Placed, Approved, Packed statuses)
      const processingStatuses = [ORDER_STATUSES.PLACED, ORDER_STATUSES.APPROVED, ORDER_STATUSES.PACKED];
      const allOrders = [];
      
      // Fetch orders for each processing status
      for (const status of processingStatuses) {
        const statusFilter = { ...filters, status };
        const result = await this.getAllOrders(statusFilter);
        
        if (result.success) {
          allOrders.push(...result.orders);
        }
      }
      
      // Sort by priority and age for optimal processing order
      const prioritizedQueue = allOrders.sort((a, b) => {
        // Priority scoring (higher number = higher priority)
        const priorityScores = {
          [ORDER_PRIORITIES.URGENT]: 4,
          [ORDER_PRIORITIES.HIGH]: 3,
          [ORDER_PRIORITIES.NORMAL]: 2,
          [ORDER_PRIORITIES.LOW]: 1
        };
        
        const priorityA = priorityScores[a.priority] || 2;
        const priorityB = priorityScores[b.priority] || 2;
        
        // First sort by priority
        if (priorityA !== priorityB) {
          return priorityB - priorityA;
        }
        
        // Then by age (older orders first)
        return (a.orderAge || 0) - (b.orderAge || 0);
      });
      
      // Group by status for easier processing
      const queueByStatus = prioritizedQueue.reduce((acc, order) => {
        const status = order.status;
        if (!acc[status]) {
          acc[status] = [];
        }
        acc[status].push(order);
        return acc;
      }, {});
      
      console.log(`✅ AdminOrderService: Processing queue generated with ${prioritizedQueue.length} orders`);
      
      return {
        success: true,
        queue: {
          all: prioritizedQueue,
          byStatus: queueByStatus,
          totalCount: prioritizedQueue.length,
          statusCounts: Object.keys(queueByStatus).reduce((acc, status) => {
            acc[status] = queueByStatus[status].length;
            return acc;
          }, {})
        }
      };
      
    } catch (error) {
      console.error('❌ AdminOrderService: Error generating processing queue:', error);
      return {
        success: false,
        error: error.message || 'Failed to generate processing queue'
      };
    }
  }
}

// Export the service class for use in admin components
export default AdminOrderService; 