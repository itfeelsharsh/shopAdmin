import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Trash2, Zap, Sliders, RefreshCw, Layers } from "react-feather";
import { toast } from "react-toastify";
import { Card, Button, Input } from "./ui";
import {
  mergeOptionGroups,
  normalizeOptions,
} from "../utils/productOptions";
import {
  emptyCatalog,
  generateOptionsWithAI,
  loadOptionCatalog,
} from "../utils/optionCatalog";

/**
 * Dynamic, catalogue-driven product options editor.
 *
 * No hard-coded category presets. Suggestions come from real products in the
 * selected category/brand, saved templates, or AI, and every group remains
 * manually editable.
 */
const ProductOptionsEditor = ({
  options = [],
  onChange,
  category = "",
  brand = "",
  productName = "",
}) => {
  const [newValues, setNewValues] = useState({});
  const [newGroupName, setNewGroupName] = useState("");
  const [catalog, setCatalog] = useState(() => emptyCatalog());
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiGroups, setAiGroups] = useState([]);
  const autoSeededKeyRef = useRef("");

  const safeOptions = useMemo(() => (Array.isArray(options) ? options : []), [options]);
  const normalizedOptions = useMemo(() => normalizeOptions(safeOptions), [safeOptions]);
  const catalogKey = `${String(category || "").trim()}|${String(brand || "").trim()}`;

  const hasCategorySuggestions = Boolean(category) && catalog.categoryGroups.length > 0;
  const hasBrandSuggestions = Boolean(brand) && catalog.brandGroups.length > 0;
  const hasSuggestions = hasCategorySuggestions || hasBrandSuggestions;

  const refreshCatalog = async (force = false) => {
    if (!category && !brand) {
      setCatalog(emptyCatalog());
      return;
    }

    setCatalogLoading(true);
    try {
      const value = await loadOptionCatalog({ category, brand, force });
      setCatalog(value);
    } catch (error) {
      console.warn("Unable to load option suggestions:", error?.message || error);
      setCatalog(emptyCatalog());
    } finally {
      setCatalogLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    setAiGroups([]);
    setCatalog(emptyCatalog());

    if (!category && !brand) {
      setCatalogLoading(false);
      return () => {
        active = false;
      };
    }

    setCatalogLoading(true);
    loadOptionCatalog({ category, brand })
      .then((value) => {
        if (active) setCatalog(value);
      })
      .catch((error) => {
        console.warn("Unable to load option suggestions:", error?.message || error);
        if (active) setCatalog(emptyCatalog());
      })
      .finally(() => {
        if (active) setCatalogLoading(false);
      });

    return () => {
      active = false;
    };
  }, [category, brand]);

  // A saved category/brand template automatically seeds a brand-new listing,
  // so repeat products in the same family stay consistent without hard-coding.
  useEffect(() => {
    if (!catalog.loaded || catalog.key !== catalogKey) return;
    if (autoSeededKeyRef.current === catalogKey) return;

    autoSeededKeyRef.current = catalogKey;
    if (normalizedOptions.length > 0) return;

    const seed = catalog.categoryTemplateGroups.length > 0
      ? catalog.categoryTemplateGroups
      : catalog.brandTemplateGroups;

    if (seed.length > 0) {
      onChange(normalizeOptions(seed));
    }
  }, [catalog, catalogKey, normalizedOptions.length, onChange]);

  const applyGroups = (groups) => {
    const incoming = normalizeOptions(groups);
    if (!incoming.length) return;
    onChange(mergeOptionGroups([...normalizedOptions, ...incoming]));
  };

  const handleAiSuggest = async () => {
    if (!String(productName || "").trim()) {
      toast.error("Enter a product name first so AI knows what it is selling.");
      return;
    }

    setAiLoading(true);
    try {
      const groups = await generateOptionsWithAI({
        name: productName,
        category,
        brand,
        existingOptions: normalizedOptions,
        catalogueOptions: catalog.mergedGroups,
      });

      if (!groups.length) {
        toast.info("AI could not find real purchasable variations for this product.");
        return;
      }

      setAiGroups(groups);
      applyGroups(groups);
      toast.success(`AI added ${groups.length} option group${groups.length > 1 ? "s" : ""}.`);
    } catch (error) {
      console.error("AI option generation failed:", error);
      toast.error(error.message || "AI option generation failed");
    } finally {
      setAiLoading(false);
    }
  };

  const updateGroup = (index, patch) => {
    onChange(safeOptions.map((group, i) => (i === index ? { ...group, ...patch } : group)));
  };

  const addGroup = (preset = null) => {
    const name = String(preset?.name || newGroupName || "").trim();
    if (!name) return;

    const existing = normalizedOptions.find(
      (group) => group.name.toLowerCase() === name.toLowerCase()
    );

    if (existing) {
      // Reuse the existing group instead of creating a duplicate.
      applyGroups([{ ...existing, ...(preset || {}), name: existing.name }]);
      if (!preset) setNewGroupName("");
      return;
    }

    onChange([
      ...safeOptions,
      {
        name,
        values: Array.isArray(preset?.values) ? [...preset.values] : [],
        required: preset?.required !== false,
      },
    ]);
    if (!preset) setNewGroupName("");
  };

  const removeGroup = (index) => {
    onChange(safeOptions.filter((_, i) => i !== index));
    setNewValues((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const addValue = (index) => {
    const raw = String(newValues[index] || "").trim();
    if (!raw) return;

    const group = safeOptions[index];
    if (!group) return;

    const values = Array.isArray(group.values) ? group.values : [];
    if (values.some((value) => value.toLowerCase() === raw.toLowerCase())) {
      setNewValues((prev) => ({ ...prev, [index]: "" }));
      return;
    }

    updateGroup(index, { values: [...values, raw] });
    setNewValues((prev) => ({ ...prev, [index]: "" }));
  };

  const removeValue = (index, value) => {
    const group = safeOptions[index];
    if (!group) return;
    updateGroup(index, { values: (group.values || []).filter((entry) => entry !== value) });
  };

  const renderSuggestion = (group, source) => (
    <button
      key={`${source}-${group.name}`}
      type="button"
      onClick={() => applyGroups([group])}
      className="group flex w-full items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-sm"
    >
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
          <Plus className="h-3 w-3 text-violet-500" />
          {group.name}
        </span>
        <span className="mt-0.5 block truncate text-[11px] font-medium text-gray-400">
          {group.values.slice(0, 6).join(" / ")}
        </span>
      </span>
      <span className="shrink-0 rounded-full bg-gray-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-gray-500">
        {source}
      </span>
    </button>
  );

  return (
    <Card title="Product Options" icon={<Sliders className="w-5 h-5 text-violet-600" />}>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <p className="max-w-xl text-sm text-slate-500">
            Add real choices customers must make before buying. Suggestions are learned from
            products already in this category/brand, generated by AI, or added manually.
            Everything is editable.
          </p>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              type="button"
              onClick={handleAiSuggest}
              loading={aiLoading}
              disabled={aiLoading || !String(productName || "").trim()}
              icon={<Zap className="w-4 h-4" />}
              className="!bg-violet-600 hover:!bg-violet-700"
            >
              {aiLoading ? "Thinking..." : "Suggest with AI"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => refreshCatalog(true)}
              disabled={catalogLoading || (!category && !brand)}
              icon={<RefreshCw className={`w-4 h-4 ${catalogLoading ? "animate-spin" : ""}`} />}
              className="!border-gray-200 !text-gray-600 hover:!bg-gray-50"
            >
              Refresh
            </Button>
          </div>
        </div>

        {!String(productName || "").trim() && (
          <p className="text-xs font-medium text-amber-600">
            Enter a product name in Basic Info to enable AI suggestions.
          </p>
        )}

        {/* Catalogue suggestions */}
        {catalogLoading ? (
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-600">
              <Layers className="h-4 w-4 animate-pulse text-violet-500" />
              Reading existing catalogue options…
            </div>
          </div>
        ) : hasSuggestions ? (
          <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-violet-900">
                <Layers className="h-4 w-4" />
                Reuse from your catalogue
                {catalog.productCount > 0 && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-400">
                    {catalog.productCount} product{catalog.productCount === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => applyGroups(catalog.mergedGroups)}
                className="!border-violet-200 !px-3 !py-1.5 text-xs !text-violet-700 hover:!bg-white"
              >
                Apply all
              </Button>
            </div>

            {hasCategorySuggestions && (
              <div className="mt-3 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-400">
                  Used in {category}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {catalog.categoryGroups.map((group) => renderSuggestion(group, "Category"))}
                </div>
              </div>
            )}

            {hasBrandSuggestions && (
              <div className="mt-3 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-400">
                  Used by {brand}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {catalog.brandGroups.map((group) => renderSuggestion(group, "Brand"))}
                </div>
              </div>
            )}

            {catalog.categoryGroups.length === 0 && catalog.brandGroups.length === 0 && (
              <p className="mt-3 text-xs text-violet-500">
                A saved template is ready. Apply all to use it.
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/60 p-4">
            <p className="text-sm font-semibold text-gray-700">No existing options yet</p>
            <p className="mt-1 text-xs text-gray-500">
              This is the first product in this category/brand with options. Ask AI or create
              your own below — it will be remembered for future products automatically.
            </p>
          </div>
        )}

        {aiGroups.length > 0 && (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
            <p className="text-xs font-semibold text-emerald-800">
              AI suggested {aiGroups.map((group) => group.name).join(", ")}. They were added to
              your options below.
            </p>
          </div>
        )}

        {/* Existing option groups */}
        <AnimatePresence initial={false}>
          {safeOptions.map((group, index) => (
            <motion.div
              key={index}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <Input
                    label={`Option ${index + 1}`}
                    placeholder="e.g. Size"
                    value={group.name}
                    onChange={(event) => updateGroup(index, { name: event.target.value })}
                    className="mb-0"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 sm:mt-5">
                  <input
                    type="checkbox"
                    checked={group.required !== false}
                    onChange={(event) => updateGroup(index, { required: event.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                  />
                  Required
                </label>
                <button
                  type="button"
                  onClick={() => removeGroup(index)}
                  className="mt-1 self-start rounded-lg p-2 text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 sm:mt-5"
                  aria-label={`Remove ${group.name || "option"}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <AnimatePresence initial={false}>
                  {(group.values || []).map((value) => (
                    <motion.span
                      key={value}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700"
                    >
                      {value}
                      <button
                        type="button"
                        onClick={() => removeValue(index, value)}
                        className="rounded-full p-0.5 text-gray-400 transition-colors hover:bg-white hover:text-red-500"
                        aria-label={`Remove ${value}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </motion.span>
                  ))}
                </AnimatePresence>
              </div>

              <div className="mt-3 flex gap-2">
                <Input
                  placeholder={`Add value${group.name ? ` for ${group.name}` : ""}`}
                  value={newValues[index] || ""}
                  onChange={(event) =>
                    setNewValues((prev) => ({ ...prev, [index]: event.target.value }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addValue(index);
                    }
                  }}
                  className="mb-0 flex-1"
                />
                <Button
                  type="button"
                  onClick={() => addValue(index)}
                  icon={<Plus className="w-4 h-4" />}
                  className="shrink-0"
                >
                  Add
                </Button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        <div className="flex flex-col gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-4 sm:flex-row sm:items-center">
          <Input
            placeholder="New option group, e.g. Capacity"
            value={newGroupName}
            onChange={(event) => setNewGroupName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addGroup();
              }
            }}
            className="mb-0 flex-1"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => addGroup()}
            disabled={!newGroupName.trim()}
            icon={<Plus className="w-4 h-4" />}
            className="shrink-0"
          >
            Add option group
          </Button>
        </div>

        <p className="text-xs text-gray-400">
          Saving the product remembers these groups for the {category || "selected"} category
          {brand ? ` and ${brand}` : ""} — future listings can reuse them automatically.
        </p>
      </div>
    </Card>
  );
};

export default ProductOptionsEditor;
