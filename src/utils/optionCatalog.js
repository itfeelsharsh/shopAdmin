import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db, getAppCheckToken } from '../firebase';
import {
  collectOptionGroups,
  mergeOptionGroups,
  normalizeOptions,
} from './productOptions';

/**
 * Dynamic option catalogue.
 *
 * Suggestions are derived from:
 *  1. Real products already using options in the selected category.
 *  2. Real products already using options for the selected brand.
 *  3. Reusable per-category / per-brand templates saved from previous listings.
 *
 * Nothing is hard-coded. Every product save also teaches the catalogue, so
 * future listings can reuse the same option names and values automatically.
 */

const TEMPLATE_COLLECTION = 'optionTemplates';
const CACHE_TTL = 30 * 1000;
const catalogCache = new Map();

const text = (value) => String(value ?? '').trim();

const slugify = (value) =>
  text(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'default';

const templateId = (scope, key) => `${scope}__${slugify(key)}`;

const readTemplate = async (scope, key) => {
  if (!key) return [];
  try {
    const snap = await getDoc(doc(db, TEMPLATE_COLLECTION, templateId(scope, key)));
    return snap.exists() ? normalizeOptions(snap.data()?.options) : [];
  } catch (error) {
    console.warn(`Unable to read ${scope} option template:`, error?.message || error);
    return [];
  }
};

const queryProducts = async (field, value, max = 60) => {
  if (!value) return [];
  try {
    const snap = await getDocs(
      query(collection(db, 'products'), where(field, '==', value), limit(max))
    );
    return snap.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
  } catch (error) {
    console.warn(`Unable to load products by ${field}:`, error?.message || error);
    return [];
  }
};

/**
 * Load category/brand suggestions from real catalogue usage and saved templates.
 */
export const loadOptionCatalog = async ({ category, brand, force = false } = {}) => {
  const normalizedCategory = text(category);
  const normalizedBrand = text(brand);
  const cacheKey = `${normalizedCategory}|${normalizedBrand}`;
  const now = Date.now();

  if (!normalizedCategory && !normalizedBrand) {
    return emptyCatalog();
  }

  const cached = catalogCache.get(cacheKey);
  if (!force && cached && now - cached.at < CACHE_TTL) {
    return cached.value;
  }

  const [
    categoryProducts,
    brandProducts,
    categoryTemplate,
    brandTemplate,
  ] = await Promise.all([
    queryProducts('type', normalizedCategory, 60),
    queryProducts('brand', normalizedBrand, 40),
    readTemplate('category', normalizedCategory),
    readTemplate('brand', normalizedBrand),
  ]);

  const categoryGroups = mergeOptionGroups([
    ...collectOptionGroups(categoryProducts),
    ...categoryTemplate,
  ]);
  const brandGroups = mergeOptionGroups([
    ...collectOptionGroups(brandProducts),
    ...brandTemplate,
  ]);

  const value = {
    loaded: true,
    key: cacheKey,
    categoryGroups,
    brandGroups,
    categoryTemplateGroups: normalizeOptions(categoryTemplate),
    brandTemplateGroups: normalizeOptions(brandTemplate),
    mergedGroups: mergeOptionGroups([...categoryGroups, ...brandGroups, ...categoryTemplate, ...brandTemplate]),
    productCount: categoryProducts.length + brandProducts.length,
  };

  catalogCache.set(cacheKey, { at: now, value });
  return value;
};

export const emptyCatalog = () => ({
  loaded: true,
  key: '',
  categoryGroups: [],
  brandGroups: [],
  categoryTemplateGroups: [],
  brandTemplateGroups: [],
  mergedGroups: [],
  productCount: 0,
});

export const clearOptionCatalogCache = () => {
  catalogCache.clear();
};

const mergeTemplate = async (scope, key, options) => {
  const normalized = normalizeOptions(options);
  if (!normalized.length) return;

  const ref = doc(db, TEMPLATE_COLLECTION, templateId(scope, key));
  const snap = await getDoc(ref);
  const existing = snap.exists() ? normalizeOptions(snap.data()?.options) : [];
  const merged = mergeOptionGroups([...existing, ...normalized]);

  await setDoc(
    ref,
    {
      scope,
      key: text(key),
      options: merged,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

const ensureTaxonomyEntry = async (settingDoc, field, value) => {
  const cleaned = text(value);
  if (!cleaned) return;

  const ref = doc(db, 'settings', settingDoc);
  const snap = await getDoc(ref);
  const list = snap.exists() && Array.isArray(snap.data()?.[field])
    ? snap.data()[field].map((entry) => text(entry)).filter(Boolean)
    : [];

  if (list.some((entry) => entry.toLowerCase() === cleaned.toLowerCase())) return;

  await setDoc(
    ref,
    {
      [field]: [...list, cleaned],
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

/**
 * Teach the catalogue after a product is saved.
 * - unions the product's options into the category + brand templates
 * - ensures the category/brand exist in the settings taxonomy
 */
export const rememberProductContext = async ({ category, brand, options }) => {
  const normalized = normalizeOptions(options);
  const tasks = [];

  if (category) {
    if (normalized.length) tasks.push(mergeTemplate('category', category, normalized));
    tasks.push(ensureTaxonomyEntry('categories', 'categories', category));
  }

  if (brand) {
    if (normalized.length) tasks.push(mergeTemplate('brand', brand, normalized));
    tasks.push(ensureTaxonomyEntry('brands', 'brands', brand));
  }

  const results = await Promise.allSettled(tasks);
  results.forEach((result) => {
    if (result.status === 'rejected') {
      console.warn('Option catalogue update failed:', result.reason?.message || result.reason);
    }
  });

  clearOptionCatalogCache();
};

/**
 * Ask the server-side AI endpoint for option groups based on the product name,
 * category, brand and real catalogue usage.
 */
export const generateOptionsWithAI = async ({
  name,
  category,
  brand,
  existingOptions = [],
  catalogueOptions = [],
}) => {
  const apiBase = typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:8788'
    : '';

  const headers = { 'Content-Type': 'application/json' };
  const appCheckToken = await getAppCheckToken();
  if (appCheckToken) headers['X-Firebase-AppCheck'] = appCheckToken;

  const response = await fetch(`${apiBase}/api/generate-options`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: text(name),
      category: text(category),
      brand: text(brand),
      existingOptions: normalizeOptions(existingOptions),
      catalogueOptions: normalizeOptions(catalogueOptions),
    }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.error) {
    throw new Error(result.error?.message || result.error || 'AI option generation failed');
  }

  return normalizeOptions(result.options);
};
