import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import { Trash2, Plus, Edit, Check, X, Globe, ExternalLink, Image as ImageIcon } from 'react-feather';

/**
 * Banner Manager Component
 * 
 * This component allows administrators to manage banner images displayed on the homepage
 * Features:
 * - Add up to 5 banner images with URLs
 * - Delete existing banners
 * - Enable/disable banner slideshow
 * - Preview banners before saving
 * 
 * @returns {JSX.Element} The Banner Manager component
 */
const BannerManager = () => {
  // State for banner data
  const [banners, setBanners] = useState([]);
  const [newBanner, setNewBanner] = useState({ imageUrl: '', active: true });
  const [isEditing, setIsEditing] = useState(false);
  const [currentEditId, setCurrentEditId] = useState(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [slideshowEnabled, setSlideshowEnabled] = useState(true);
  const [performingAction, setPerformingAction] = useState(false);
  const [processingBannerId, setProcessingBannerId] = useState(null); // ID of the banner currently undergoing processing

  // Fetch banners on component mount
  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const bannersCollection = collection(db, 'banners');
        const bannersSnapshot = await getDocs(bannersCollection);
        const bannersData = bannersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Sort banners by order property
        bannersData.sort((a, b) => a.order - b.order);
        setBanners(bannersData);
        
        // Get slideshow setting
        const settingsCollection = collection(db, 'settings');
        const settingsSnapshot = await getDocs(settingsCollection);
        const settingsData = settingsSnapshot.docs.find(doc => doc.id === 'bannerSettings');
        if (settingsData) {
          setSlideshowEnabled(settingsData.data().slideshowEnabled ?? true);
        }
      } catch (error) {
        console.error('Error fetching banners:', error);
        toast.error('Failed to load banner data');
      }
    };
    
    fetchBanners();
  }, []);

  /**
   * Handles adding a new banner to the collection
   */
  const handleAddBanner = async () => {
    if (!newBanner.imageUrl.trim()) {
      toast.error('Banner URL cannot be empty');
      return;
    }
    
    if (banners.length >= 5) {
      toast.error('Maximum of 5 banners allowed');
      return;
    }
    
    try {
      setPerformingAction(true);
      
      // Enforce deliberate 2-second delay for professional visual confirmation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Create banner with unique ID
      const bannerRef = doc(collection(db, 'banners'));
      await setDoc(bannerRef, {
        ...newBanner,
        order: banners.length,
        createdAt: new Date()
      });
      
      toast.success('Banner added successfully');
      
      // Update local state
      setBanners([...banners, {
        id: bannerRef.id,
        ...newBanner,
        order: banners.length,
        createdAt: new Date()
      }]);
      
      // Reset form
      setNewBanner({ imageUrl: '', active: true });
      setIsAddingNew(false);
    } catch (error) {
      console.error('Error adding banner:', error);
      toast.error('Failed to add banner');
    } finally {
      setPerformingAction(false);
    }
  };

  /**
   * Handles updating an existing banner
   */
  const handleUpdateBanner = async () => {
    if (!newBanner.imageUrl.trim()) {
      toast.error('Banner URL cannot be empty');
      return;
    }
    
    try {
      setPerformingAction(true);
      setProcessingBannerId(currentEditId);
      
      // Enforce deliberate 2-second delay for professional visual confirmation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update banner in Firestore
      const bannerRef = doc(db, 'banners', currentEditId);
      await setDoc(bannerRef, newBanner, { merge: true });
      
      // Update local state
      setBanners(banners.map(banner => 
        banner.id === currentEditId ? { ...banner, ...newBanner } : banner
      ));
      
      toast.success('Banner updated successfully');
      
      // Reset form
      setNewBanner({ imageUrl: '', active: true });
      setIsEditing(false);
      setCurrentEditId(null);
    } catch (error) {
      console.error('Error updating banner:', error);
      toast.error('Failed to update banner');
    } finally {
      setPerformingAction(false);
      setProcessingBannerId(null);
    }
  };

  /**
   * Handles deleting a banner
   * @param {string} id - ID of the banner to delete
   */
  const handleDeleteBanner = async (id) => {
    if (!window.confirm('Are you sure you want to delete this banner?')) {
      return;
    }
    
    try {
      setPerformingAction(true);
      setProcessingBannerId(id);
      
      // Enforce deliberate 2-second delay for professional visual confirmation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Delete banner from Firestore
      await deleteDoc(doc(db, 'banners', id));
      
      // Update local state
      const updatedBanners = banners.filter(banner => banner.id !== id);
      
      // Re-order remaining banners
      const reorderedBanners = updatedBanners.map((banner, index) => ({
        ...banner,
        order: index
      }));
      
      // Update order in Firestore
      for (const banner of reorderedBanners) {
        await setDoc(doc(db, 'banners', banner.id), { order: banner.order }, { merge: true });
      }
      
      setBanners(reorderedBanners);
      toast.success('Banner deleted successfully');
    } catch (error) {
      console.error('Error deleting banner:', error);
      toast.error('Failed to delete banner');
    } finally {
      setPerformingAction(false);
      setProcessingBannerId(null);
    }
  };

  /**
   * Initiates editing of a banner
   * @param {Object} banner - Banner object to edit
   */
  const startEdit = (banner) => {
    setNewBanner({
      imageUrl: banner.imageUrl,
      active: banner.active
    });
    setIsEditing(true);
    setCurrentEditId(banner.id);
    setIsAddingNew(false);
  };

  /**
   * Cancels the current edit or add operation
   */
  const cancelEdit = () => {
    setNewBanner({ imageUrl: '', active: true });
    setIsEditing(false);
    setCurrentEditId(null);
    setIsAddingNew(false);
  };

  /**
   * Updates the slideshow setting
   */
  const updateSlideshowSetting = async () => {
    try {
      setPerformingAction(true);
      
      // Enforce deliberate 2-second delay for professional visual confirmation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const newSetting = !slideshowEnabled;
      await setDoc(doc(db, 'settings', 'bannerSettings'), {
        slideshowEnabled: newSetting
      }, { merge: true });
      setSlideshowEnabled(newSetting);
      toast.success(`Slideshow ${newSetting ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error updating slideshow setting:', error);
      toast.error('Failed to update slideshow setting');
    } finally {
      setPerformingAction(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Banner Management</h2>
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <label className="relative inline-flex items-center cursor-pointer mr-2">
              <input 
                type="checkbox" 
                checked={slideshowEnabled} 
                onChange={updateSlideshowSetting}
                disabled={performingAction}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
            <span className="text-sm font-medium text-gray-700">Enable Slideshow</span>
          </div>
          <button
            onClick={() => {
              if (banners.length >= 5) {
                toast.error('Maximum of 5 banners allowed');
                return;
              }
              setIsAddingNew(true);
              setIsEditing(false);
            }}
            disabled={isAddingNew || isEditing || banners.length >= 5}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
          >
            <Plus size={16} className="mr-1" /> Add Banner
          </button>
        </div>
      </div>

      {/* Add/Edit Banner Form */}
      {(isAddingNew || isEditing) && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-white rounded-lg shadow-md p-6 mb-6"
        >
          <h3 className="text-lg font-semibold mb-4">
            {isEditing ? 'Edit Banner' : 'Add New Banner'}
          </h3>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Banner Image URL
              </label>
              <div className="flex">
                <div className="flex-grow">
                  <input
                    type="text"
                    value={newBanner.imageUrl}
                    onChange={(e) => setNewBanner({ ...newBanner, imageUrl: e.target.value })}
                    placeholder="https://example.com/banner-image.jpg"
                    className="w-full px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex items-center">
                  <a
                    href={newBanner.imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 border border-l-0 border-gray-300 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-r-md"
                    title="Open image in new tab"
                  >
                    <ExternalLink size={16} />
                  </a>
                </div>
              </div>
            </div>
            
            <div className="flex items-center">
              <label className="relative inline-flex items-center cursor-pointer mr-2">
                <input 
                  type="checkbox" 
                  checked={newBanner.active} 
                  onChange={(e) => setNewBanner({ ...newBanner, active: e.target.checked })}
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
              <span className="text-sm font-medium text-gray-700">Active</span>
            </div>

            {newBanner.imageUrl && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Preview
                </label>
                <div className="border border-gray-200 rounded-md overflow-hidden">
                  <img
                    src={newBanner.imageUrl}
                    alt="Banner preview"
                    className="w-full h-32 object-cover"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300" preserveAspectRatio="none"%3E%3Cdefs%3E%3Cstyle type="text/css"%3E%23holder text %7B fill: %23999;%7D%3C/style%3E%3C/defs%3E%3Cg id="holder"%3E%3Crect width="400" height="300" fill="%23E0E0E0"%3E%3C/rect%3E%3Cg%3E%3Ctext x="148" y="156.5" style="font-size:40px" text-anchor="middle"%3EImage Error%3C/text%3E%3C/g%3E%3C/g%3E%3C/svg%3E';
                    }}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3 mt-2">
              <button
                onClick={cancelEdit}
                disabled={performingAction}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                <X size={16} className="inline mr-1" /> Cancel
              </button>
              <button
                onClick={isEditing ? handleUpdateBanner : handleAddBanner}
                disabled={performingAction}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check size={16} className="inline mr-1" />
                {performingAction 
                  ? (isEditing ? 'Updating...' : 'Adding...')
                  : (isEditing ? 'Update Banner' : 'Add Banner')}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Banners List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-4 bg-gray-50 border-b">
          <h3 className="text-lg font-medium text-gray-900">Current Banners ({banners.length}/5)</h3>
        </div>
        
        {banners.length === 0 ? (
          <div className="p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 text-blue-500 mb-4">
              <ImageIcon size={24} />
            </div>
            <p className="text-gray-500">No banners have been added yet.</p>
            <p className="text-sm text-gray-400 mt-1">
              Add your first banner to display it on the homepage.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {banners.map((banner, index) => (
              <motion.li 
                key={banner.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 flex items-center justify-between hover:bg-gray-50"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded-md overflow-hidden">
                    {banner.imageUrl ? (
                      <img 
                        src={banner.imageUrl} 
                        alt={`Banner ${index + 1}`}
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <ImageIcon size={20} className="text-gray-400" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 truncate max-w-xs">
                      {banner.imageUrl}
                    </h4>
                    <div className="mt-1 flex items-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${banner.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {banner.active ? 'Active' : 'Inactive'}
                      </span>
                      <span className="ml-2 text-xs text-gray-500">
                        Order: {banner.order + 1}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => startEdit(banner)}
                    disabled={performingAction || isEditing || isAddingNew}
                    className="p-1 rounded-full text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => handleDeleteBanner(banner.id)}
                    disabled={performingAction || isEditing || isAddingNew}
                    className="p-1 rounded-full text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[24px]"
                  >
                    {processingBannerId === banner.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-600 border-t-transparent"></div>
                    ) : (
                      <Trash2 size={18} />
                    )}
                  </button>
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </div>

      {/* Help Text */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-md">
        <div className="flex">
          <div className="flex-shrink-0">
            <Globe className="h-5 w-5 text-blue-400" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Banner Guidelines</h3>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc space-y-1 pl-5">
                <li>For best appearance, use images with 1200 × 300 pixels resolution (4:1 ratio)</li>
                <li>Banners will automatically create a slideshow when more than one is active</li>
                <li>Maximum of 5 banners can be added to the slideshow</li>
                <li>Images must be accessible via a direct URL (HTTPS recommended)</li>
                <li>Set banners as inactive rather than deleting them if you plan to use them again</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BannerManager; 